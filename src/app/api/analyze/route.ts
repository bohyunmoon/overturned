import { classifyByRules } from "@/lib/classify";
import { guard } from "@/lib/guard";
import { analyzeWithModel, hasModel, type ImageMediaType } from "@/lib/llm";

export const maxDuration = 60;

const MAX_TEXT = 20_000;
const MAX_IMAGE_BASE64 = 5_500_000; // about 4 MB of image
const IMAGE_TYPES: ImageMediaType[] = ["image/jpeg", "image/png", "image/webp"];

/** Errors are returned as codes; the interface shows them in the reader's language. */
const bad = (code: string, status = 400) => Response.json({ error: code }, { status });

export async function POST(req: Request) {
  const allowed = hasModel() ? await guard(req, "ai") : ({ ok: true, ai: false } as const);
  if (!allowed.ok) return bad("rate_limited", 429);
  const ai = allowed.ai; // false with no key, or once the site's daily AI cap is spent

  let body: { text?: unknown; locale?: unknown; image?: { mediaType?: unknown; base64?: unknown } };
  try {
    body = await req.json();
  } catch {
    return bad("bad_json");
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  const image = body.image;
  const locale = body.locale === "ko" ? "ko" : "en";

  if (image) {
    const mediaType = IMAGE_TYPES.find((t) => t === image.mediaType);
    const base64 = typeof image.base64 === "string" ? image.base64 : "";
    if (!mediaType || !base64) return bad("photo_type");
    if (base64.length > MAX_IMAGE_BASE64) return bad("photo_large", 413);
    if (!ai) {
      return bad("photo_off", 503);
    }
    try {
      return Response.json({ analysis: await analyzeWithModel({ image: { mediaType, base64 } }, locale) });
    } catch (err) {
      console.error("analyze(image) failed:", err instanceof Error ? err.message : err);
      return bad("photo_unreadable", 502);
    }
  }

  if (text.length < 40) return bad("text_short");
  if (text.length > MAX_TEXT) return bad("text_long", 413);

  if (ai) {
    try {
      return Response.json({ analysis: await analyzeWithModel({ text }, locale) });
    } catch (err) {
      // Fall through to the offline reader so the person is never stuck.
      console.error("analyze(text) failed, using rules:", err instanceof Error ? err.message : err);
    }
  }
  return Response.json({ analysis: classifyByRules(text) });
}
