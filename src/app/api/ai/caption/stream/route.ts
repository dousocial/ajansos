import { NextRequest } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import { auth } from "@/auth";
import { rateLimit, keyFromRequest, rateLimitHeaders } from "@/lib/rate-limit";

export const runtime = "nodejs";

// Gemini istemcisi lazy — env değişkeni eksikse modül yüklenirken patlamasın,
// hata yalnızca çağrı sırasında tetiklensin ve kullanıcıya temiz şekilde aktarılsın.
let cachedClient: GoogleGenerativeAI | null = null;
function getGeminiClient(): GoogleGenerativeAI {
  if (cachedClient) return cachedClient;
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("AI_UNAVAILABLE: GEMINI_API_KEY tanımlı değil");
  }
  cachedClient = new GoogleGenerativeAI(key);
  return cachedClient;
}

const TONE_PROMPTS: Record<string, string> = {
  fun: "eğlenceli, enerjik, emoji kullanımı serbest",
  inspirational: "ilham verici, motive edici, güçlü mesaj",
  professional: "kurumsal, sade, bilgilendirici",
};

const InputSchema = z.object({
  brief: z.string().max(1000),
  platform: z.enum(["INSTAGRAM", "FACEBOOK", "TIKTOK", "LINKEDIN", "YOUTUBE", "TWITTER"]),
  postType: z.enum(["IMAGE", "VIDEO", "REEL", "STORY", "CAROUSEL"]),
  brandVoice: z.string().optional(),
  tones: z
    .array(z.string())
    .optional()
    .default(["fun", "inspirational", "professional"]),
});

export async function POST(req: NextRequest) {
  // AI çağrıları pahalı (Gemini token + rate limit) → kullanıcı/IP başına
  // dakikada 20 istek. Authn'lı ise userId, değilse IP üzerinden.
  const session = await auth();
  if (!session?.user) {
    return new Response(JSON.stringify({ error: "Yetkisiz" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  const RL_LIMIT = 20;
  const rl = rateLimit({
    key: `ai:caption:${session.user.id ?? keyFromRequest(req, "ip")}`,
    limit: RL_LIMIT,
    windowMs: 60_000,
  });
  if (!rl.allowed) {
    return new Response(
      JSON.stringify({ error: "Çok fazla istek, biraz bekle" }),
      {
        status: 429,
        headers: { "Content-Type": "application/json", ...rateLimitHeaders(rl, RL_LIMIT) },
      }
    );
  }

  let parsed: z.infer<typeof InputSchema>;

  try {
    const body = await req.json();
    parsed = InputSchema.parse(body);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid input" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { brief, platform, postType, brandVoice, tones } = parsed;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };
      const close = () => {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      };

      let genAI: GoogleGenerativeAI;
      try {
        genAI = getGeminiClient();
      } catch (e) {
        const message =
          e instanceof Error && e.message.startsWith("AI_UNAVAILABLE")
            ? "AI servisi şu anda yapılandırılmamış. Lütfen yöneticinize başvurun."
            : "AI servisine bağlanılamadı.";
        send({ type: "error", message });
        close();
        return;
      }

      const suggestions: { tone: string; caption: string }[] = [];

      for (const tone of tones) {
        const toneLabel = TONE_PROMPTS[tone] ?? tone;

        const prompt = `Sen bir sosyal medya içerik uzmanısın.
Platform: ${platform}
İçerik türü: ${postType}
Brief: ${brief}
${brandVoice ? `Marka sesi: ${brandVoice}` : ""}

"${toneLabel}" tarzında, ${platform} için optimize edilmiş, etkileşimi yüksek Türkçe bir caption yaz.
- Sadece caption metnini yaz, açıklama ekleme
- Hashtag'leri ayrı satırda sonuna ekle (5-8 adet)
- 150-280 karakter arası (hashtag hariç)`;

        send({ type: "tone_start", tone });

        let fullText = "";

        try {
          const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
          const result = await model.generateContentStream(prompt);

          for await (const chunk of result.stream) {
            const text = chunk.text();
            if (text) {
              fullText += text;
              send({ type: "chunk", tone, content: text });
            }
          }
        } catch (e) {
          // Tek ton başarısız olursa — kullanıcıya bildir, sonraki tonla devam et.
          const message = e instanceof Error ? e.message : "Bilinmeyen AI hatası";
          console.error(`[ai/caption/stream] Tone "${tone}" failed:`, message);
          send({ type: "tone_error", tone, message });
          send({ type: "tone_done", tone });
          continue;
        }

        const trimmed = fullText.trim();
        if (trimmed) {
          suggestions.push({ tone, caption: trimmed });
        }
        send({ type: "tone_done", tone });
      }

      if (suggestions.length === 0) {
        send({
          type: "error",
          message: "AI hiçbir öneri üretemedi. Lütfen daha sonra tekrar deneyin.",
        });
      } else {
        send({ type: "done", suggestions });
      }
      close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
