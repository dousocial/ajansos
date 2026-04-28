import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit, keyFromRequest, rateLimitHeaders } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

/**
 * POST /api/ai/caption/from-media
 *
 * Projeye yüklü medyayı (görseller) bir LLM Vision ile analiz edip platform'a
 * uygun Türkçe caption + hashtag listesi üretir.
 *
 * Video projelerinde görsel analizi yapmıyoruz — kullanıcının `customPrompt`
 * göndermesi zorunlu (örn. "Bu video anneler günü için eğlenceli bir tanıtım").
 *
 * Sağlayıcı seçimi `AI_PROVIDER` env değişkeniyle: "groq" (varsayılan) veya
 * "gemini". Müşteri profilinden çekilen sektör/marka sesi/iletişim bilgileri
 * prompt'a dahil; uygunsa CTA otomatik ekleniyor.
 */

const InputSchema = z.object({
  projectId: z.string().min(1),
  platform: z.enum(["INSTAGRAM", "FACEBOOK", "TIKTOK", "LINKEDIN", "YOUTUBE"]),
  customPrompt: z.string().max(2000).optional(),
});

const MAX_IMAGES = 2;
const MAX_BYTES_PER_IMAGE = 4 * 1024 * 1024;

// Sağlayıcı seçimi — Groq varsayılan (cömert free tier, multimodal Llama 4 Scout)
type Provider = "groq" | "gemini";
function getProvider(): Provider {
  const v = (process.env.AI_PROVIDER ?? "groq").toLowerCase();
  return v === "gemini" ? "gemini" : "groq";
}

const GROQ_VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
const GEMINI_MODEL = "gemini-2.0-flash-lite";

interface ImagePart {
  data: string; // base64
  mimeType: string;
}

async function fetchAsBase64(url: string): Promise<ImagePart | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > MAX_BYTES_PER_IMAGE) return null;
    const ct = res.headers.get("content-type")?.split(";")[0]?.trim();
    return { data: buf.toString("base64"), mimeType: ct ?? "image/jpeg" };
  } catch (e) {
    logger.warn("ai.caption.fetch_image_failed", { url, err: e });
    return null;
  }
}

// ─── Sağlayıcı çağrıları ─────────────────────────────────────────────────────

async function callGroq(prompt: string, images: ImagePart[]): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("AI_UNAVAILABLE: GROQ_API_KEY tanımlı değil");

  type Content =
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } };

  const content: Content[] = [{ type: "text", text: prompt }];
  for (const img of images) {
    content.push({
      type: "image_url",
      image_url: { url: `data:${img.mimeType};base64,${img.data}` },
    });
  }

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_VISION_MODEL,
      messages: [{ role: "user", content }],
      max_tokens: 600,
      temperature: 0.85,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    // Token / rate hatası — friendly mesaja çevir
    if (res.status === 429) {
      throw new Error("Groq kotası dolu. 1 dakika bekleyip tekrar dene.");
    }
    throw new Error(`Groq API hata (${res.status}): ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) throw new Error("Groq boş yanıt döndü");
  return text;
}

async function callGemini(prompt: string, images: ImagePart[]): Promise<string> {
  // Lazy import — gemini paketi bu provider seçilmediyse yüklenmesin.
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("AI_UNAVAILABLE: GEMINI_API_KEY tanımlı değil");
  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: { maxOutputTokens: 600, temperature: 0.85 },
  });

  const parts: Array<
    { text: string } | { inlineData: { data: string; mimeType: string } }
  > = [{ text: prompt }];
  for (const img of images) {
    parts.push({ inlineData: { data: img.data, mimeType: img.mimeType } });
  }

  const result = await model.generateContent(parts);
  const text = result.response.text();
  if (!text || text.trim().length === 0) {
    throw new Error("Gemini boş yanıt döndü");
  }
  return text;
}

async function generateText(
  provider: Provider,
  prompt: string,
  images: ImagePart[]
): Promise<string> {
  if (provider === "groq") return callGroq(prompt, images);
  return callGemini(prompt, images);
}

// ─── Caption + hashtag ayrıştırma ────────────────────────────────────────────

function parseCaptionAndTags(raw: string): { caption: string; hashtags: string[] } {
  const stripped = raw
    .trim()
    .replace(/^```(?:markdown|md|text)?/i, "")
    .replace(/```$/i, "")
    .trim();

  const lines = stripped.split(/\r?\n/);
  const captionLines: string[] = [];
  const hashtags: string[] = [];

  let i = lines.length - 1;
  while (i >= 0) {
    const line = lines[i].trim();
    if (!line) {
      i--;
      continue;
    }
    const tokens = line.split(/\s+/);
    const isPureHashLine =
      tokens.length > 0 && tokens.every((t) => /^#[\p{L}\p{N}_]+$/u.test(t));
    if (isPureHashLine) {
      hashtags.unshift(...tokens.filter((t) => !hashtags.includes(t)));
      i--;
    } else {
      break;
    }
  }
  for (let j = 0; j <= i; j++) captionLines.push(lines[j]);

  return { caption: captionLines.join("\n").trim(), hashtags };
}

function ctaHintForIndustry(industry: string | null | undefined): string {
  if (!industry) return "";
  const lc = industry.toLowerCase();
  if (lc.includes("spor") || lc.includes("fitness") || lc.includes("sağlık") || lc.includes("beslenme")) {
    return "Üyelik / randevu için iletişim bilgilerini caption'ın sonuna mutlaka ekle.";
  }
  if (lc.includes("yiyecek") || lc.includes("restaur") || lc.includes("kafe") || lc.includes("yemek")) {
    return "Rezervasyon / sipariş için iletişim bilgilerini caption'ın sonuna mutlaka ekle.";
  }
  if (lc.includes("güzellik") || lc.includes("kuaför") || lc.includes("estetik") || lc.includes("klinik")) {
    return "Randevu için iletişim bilgilerini caption'ın sonuna mutlaka ekle.";
  }
  if (lc.includes("e-ticaret") || lc.includes("perakende") || lc.includes("satış")) {
    return "Sipariş / bilgi için iletişim bilgilerini caption'ın sonuna mutlaka ekle.";
  }
  return "Hizmet/satış için anlamlıysa iletişim bilgisini caption'ın sonuna ekle.";
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }

  const RL_LIMIT = 10;
  const rl = rateLimit({
    key: `ai:caption-media:${session.user.id ?? keyFromRequest(req, "ip")}`,
    limit: RL_LIMIT,
    windowMs: 60_000,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Çok fazla istek, biraz bekle" },
      { status: 429, headers: rateLimitHeaders(rl, RL_LIMIT) }
    );
  }

  let parsed: z.infer<typeof InputSchema>;
  try {
    parsed = InputSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Geçersiz girdi" }, { status: 400 });
  }

  const { projectId, platform, customPrompt } = parsed;

  const project = await prisma.project.findUnique({
    where: { id: projectId, deletedAt: null },
    include: {
      client: {
        select: {
          id: true,
          name: true,
          industry: true,
          contactName: true,
          contactPhone: true,
          contactEmail: true,
          brandVoice: true,
          bannedWords: true,
          emojiPolicy: true,
        },
      },
      files: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        select: { id: true, publicUrl: true, mimeType: true, name: true },
      },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Proje bulunamadı" }, { status: 404 });
  }

  const files = project.files;
  const hasVideo =
    files.some((f) => f.mimeType.startsWith("video/")) ||
    project.postType === "VIDEO" ||
    project.postType === "REEL";
  const imageFiles = files
    .filter((f) => f.mimeType.startsWith("image/"))
    .slice(0, MAX_IMAGES);

  if (hasVideo && !customPrompt?.trim()) {
    return NextResponse.json(
      {
        needsPrompt: true,
        reason: "video_requires_prompt",
        message:
          "Video içerikler için kısa bir prompt gir (örn. 'Bu video anneler günü tanıtımıyla alakalı eğlenceli bir video, açıklama yaz').",
      },
      { status: 200 }
    );
  }

  if (!hasVideo && imageFiles.length === 0 && !customPrompt?.trim()) {
    return NextResponse.json(
      {
        needsPrompt: true,
        reason: "no_media_requires_prompt",
        message: "Bu projede henüz medya yok. AI'ın yazabilmesi için kısa bir açıklama gir.",
      },
      { status: 200 }
    );
  }

  // Prompt hazırlığı
  const c = project.client;
  const charRange =
    platform === "TIKTOK" ? "100-180" : platform === "LINKEDIN" ? "200-400" : "150-280";
  const brandLine = [
    c.name,
    c.industry,
    c.brandVoice ? `ton: ${c.brandVoice}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const ctaLine = c.contactPhone
    ? `CTA olarak sona "Daha fazlası için: ${c.contactPhone}" ekle.`
    : "";
  const banned =
    c.bannedWords && c.bannedWords.length > 0
      ? `Yasak kelimeler: ${c.bannedWords.join(", ")}.`
      : "";
  const emoji = c.emojiPolicy === false ? "Emoji yok." : "1-3 emoji kullanabilirsin.";
  const brandHashtag = `#${c.name.toLowerCase().replace(/[^a-z0-9çğıöşü]+/gi, "")}`;

  const prompt = `Türkçe ${platform} caption yaz. Marka: ${brandLine}.
${project.title ? `Başlık: ${project.title}.` : ""}${project.brief ? ` Brief: ${project.brief}.` : ""}${customPrompt ? ` İstek: ${customPrompt}.` : ""}

${charRange} karakter caption + boş satır + 5-8 hashtag (tek satır, boşluklu, ${brandHashtag} dahil).
${emoji} ${banned} ${ctaLine}
${ctaHintForIndustry(c.industry)}
Sadece caption ve hashtag yaz, başka hiçbir şey ekleme.${hasVideo ? " (Görsel yok, yalnızca yukarıdaki bilgilerden yaz.)" : ""}`;

  // Görselleri base64'e çevir
  const images: ImagePart[] = [];
  if (!hasVideo) {
    for (const f of imageFiles) {
      const b = await fetchAsBase64(f.publicUrl);
      if (b) images.push(b);
    }
  }

  // Sağlayıcı çağrısı
  const provider = getProvider();
  const usedModel = provider === "groq" ? GROQ_VISION_MODEL : GEMINI_MODEL;

  try {
    const text = await generateText(provider, prompt, images);
    const { caption, hashtags } = parseCaptionAndTags(text);

    await prisma.aiLog
      .create({
        data: {
          projectId: project.id,
          feature: "caption_from_media",
          model: usedModel,
        },
      })
      .catch((e) => logger.warn("ai.caption.log_failed", { err: e }));

    return NextResponse.json({
      caption,
      hashtags,
      provider,
      model: usedModel,
      mode: hasVideo ? "video" : imageFiles.length > 0 ? "image" : "text",
      imagesUsed: images.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Bilinmeyen AI hatası";
    logger.error("ai.caption.from_media_failed", {
      projectId,
      platform,
      provider,
      err: e,
    });
    // AI sağlayıcı hatasını UI'a aktar — kullanıcı 429/quota mesajını görsün.
    const status = msg.includes("AI_UNAVAILABLE")
      ? 503
      : msg.includes("kotası dolu") || msg.includes("429")
        ? 429
        : 502;
    return NextResponse.json({ error: msg, provider }, { status });
  }
}
