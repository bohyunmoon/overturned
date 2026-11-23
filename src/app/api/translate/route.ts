import { guard } from "@/lib/guard";
import { hasModel, translateFields } from "@/lib/llm";

export const maxDuration = 60;

const bad = (code: string, status = 400) => Response.json({ error: code }, { status });

/**
 * Translates the explanation of a denial (summary and warnings) when the
 * reader switches language after the letter has been read.
 */
export async function POST(req: Request) {
  let body: { summary?: unknown; warnings?: unknown; target?: unknown };
  try {
    body = await req.json();
  } catch {
    return bad("bad_json");
  }
  const target = body.target === "ko" ? "ko" : "en";
  const summary = typeof body.summary === "string" ? body.summary.slice(0, 1500) : "";
  const warnings = Array.isArray(body.warnings)
    ? body.warnings.filter((w): w is string => typeof w === "string" && w.trim().length > 0).slice(0, 6).map((w) => w.slice(0, 300))
    : [];
  if (!summary && !warnings.length) return bad("missing");
  if (!hasModel()) return bad("translate_off", 503);
  const allowed = await guard(req, "ai");
  if (!allowed.ok) return bad("rate_limited", 429);
  if (!allowed.ai) return bad("translate_off", 503);

  try {
    const fields: Record<string, string> = { summary };
    warnings.forEach((w, i) => (fields[`warning_${i}`] = w));
    const out = await translateFields(fields, target);
    return Response.json({ summary: out.summary, warnings: warnings.map((_, i) => out[`warning_${i}`]) });
  } catch (err) {
    console.error("translate failed:", err instanceof Error ? err.message : err);
    return bad("translate_failed", 502);
  }
}
