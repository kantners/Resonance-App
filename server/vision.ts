import type { VisionFn } from "./routes";

/**
 * OpenAI vision for screenshot parsing. HANDOFF §0 names gpt-4o-mini;
 * OPENAI_VISION_MODEL can override it if reading accuracy needs a larger model.
 * Retries up to 3 times with backoff (1 s, 2 s).
 */
export function createOpenAiVision(apiKey: string, model = process.env.OPENAI_VISION_MODEL || "gpt-4o-mini"): VisionFn {
  return async (prompt, base64Image, mimeType) => {
    const openai = new (await import("openai")).OpenAI({ apiKey });
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const completion = await openai.chat.completions.create({
          model,
          max_tokens: 1500,
          temperature: 0,
          messages: [{ role: "user", content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}`, detail: "high" } },
          ] }],
        });
        return completion.choices[0].message.content?.trim() ?? "{}";
      } catch (e: any) {
        lastError = e;
        console.warn(`[vision] attempt ${attempt}/3 failed: ${e?.message}`);
        if (attempt < 3) await new Promise(r => setTimeout(r, 2 ** (attempt - 1) * 1000));
      }
    }
    throw lastError ?? new Error("Screenshot parsing failed");
  };
}
