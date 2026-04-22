import { NextRequest } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";

export const runtime = "nodejs";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const TONE_PROMPTS: Record<string, string> = {
  fun: "eğlenceli, enerjik, emoji kullanımı serbest",
  inspirational: "ilham verici, motive edici, güçlü mesaj",
  professional: "kurumsal, sade, bilgilendirici",
};

const DEMO_CAPTIONS: Record<string, string> = {
  fun: "Hayatın tadını çıkar! 🎉 Her an bir fırsat, her gün yeni bir macera. Seninle bu yolculukta olmaktan mutluluk duyuyoruz! ✨\n\n#eğlence #yaşam #mutluluk #anıyaşa #pozitifenerji #günlük #lifestyle",
  inspirational:
    "Büyük başarılar küçük adımlarla başlar. Her gün bir adım daha ileri git, çünkü sen buna layıksın. 💪\n\n#motivasyon #başarı #hedef #ilham #güçlü #kararlılık #gelişim",
  professional:
    "Kalite ve güvenilirlik, her işimizin temelinde yer almaktadır. Profesyonel hizmet anlayışımızla yanınızdayız.\n\n#profesyonel #kalite #hizmet #güvenilir #iş #kurumsal #marka",
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
  let parsed: z.infer<typeof InputSchema>;

  try {
    const body = await req.json();
    parsed = InputSchema.parse(body);
  } catch (e) {
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

      const suggestions: { tone: string; caption: string }[] = [];

      try {
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
          } catch {
            // Fallback to demo caption for this tone
            const demoCaption = DEMO_CAPTIONS[tone] ?? `${tone} caption örneği`;
            fullText = demoCaption;
            send({ type: "chunk", tone, content: demoCaption });
          }

          suggestions.push({ tone, caption: fullText.trim() });
          send({ type: "tone_done", tone });
        }
      } catch {
        // Full fallback: return demo suggestions for all tones
        const demoSuggestions = tones.map((tone) => ({
          tone,
          caption: DEMO_CAPTIONS[tone] ?? `${tone} caption örneği`,
        }));
        send({ type: "done", suggestions: demoSuggestions });
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
        return;
      }

      send({ type: "done", suggestions });
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
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
