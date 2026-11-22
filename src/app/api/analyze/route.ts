import { classifyByRules } from "@/lib/classify";
import { analyzeWithModel, hasModel, type ImageMediaType } from "@/lib/llm";

export const maxDuration = 60;

const MAX_TEXT = 20_000;
const MAX_IMAGE_BASE64 = 5_500_000; // about 4 MB of image
const IMAGE_TYPES: ImageMediaType[] = ["image/jpeg", "image/png", "image/webp"];

const bad = (message: string, status = 400) => Response.json({ error: message }, { status });

export async function POST(req: Request) {
  let body: { text?: unknown; image?: { mediaType?: unknown; base64?: unknown } };
  try {
    body = await req.json();
  } catch {
    return bad("Request body must be JSON.");
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  const image = body.image;

  if (image) {
    const mediaType = IMAGE_TYPES.find((t) => t === image.mediaType);
    const base64 = typeof image.base64 === "string" ? image.base64 : "";
    if (!mediaType || !base64) return bad("Photo must be a JPEG, PNG or WebP image.");
    if (base64.length > MAX_IMAGE_BASE64) return bad("That photo is too large. Try a smaller one.", 413);
    if (!hasModel()) {
      return bad("Reading photos is not switched on for this site yet. Please type or paste the letter's text instead.", 503);
    }
    try {
      return Response.json({ analysis: await analyzeWithModel({ image: { mediaType, base64 } }) });
    } catch (err) {
      console.error("analyze(image) failed:", err instanceof Error ? err.message : err);
      return bad("We could not read that photo. Try a sharper, well-lit photo, or paste the text instead.", 502);
    }
  }

  if (text.length < 40) return bad("Paste the full text of the denial letter so we have enough to work with.");
  if (text.length > MAX_TEXT) return bad("That is longer than a denial letter usually is. Paste just the denial notice.", 413);

  if (hasModel()) {
    try {
      return Response.json({ analysis: await analyzeWithModel({ text }) });
    } catch (err) {
      // Fall through to the offline reader so the person is never stuck.
      console.error("analyze(text) failed, using rules:", err instanceof Error ? err.message : err);
    }
  }
  return Response.json({ analysis: classifyByRules(text) });
}
