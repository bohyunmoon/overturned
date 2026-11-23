import { parseIso } from "@/lib/deadlines";
import { applyTranslations, blankUntranslated, dropKoreanNames, koreanFields } from "@/lib/korean";
import { buildLetter } from "@/lib/letter";
import { coerceAnalysis, draftArgumentsWithModel, hasModel, translateToEnglish } from "@/lib/llm";
import { EMPTY_FACTS, type DenialAnalysis, type UserFacts } from "@/lib/types";

export const maxDuration = 60;

/** Errors are returned as codes; the interface shows them in the reader's language. */
const bad = (code: string, status = 400) => Response.json({ error: code }, { status });
const s = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

function coerceFacts(raw: Record<string, unknown>): UserFacts {
  return {
    ...EMPTY_FACTS,
    signer: raw.signer === "representative" ? "representative" : "patient",
    patientName: s(raw.patientName, 120),
    representativeName: s(raw.representativeName, 120),
    mailingAddress: s(raw.mailingAddress, 300),
    phone: s(raw.phone, 40),
    doctorName: s(raw.doctorName, 120),
    doctorSupports: raw.doctorSupports === true,
    whyNeeded: s(raw.whyNeeded, 3000),
    whatTried: s(raw.whatTried, 2000),
    harmIfDelayed: s(raw.harmIfDelayed, 2000),
    expedited: raw.expedited === true,
    lateReason: s(raw.lateReason, 1000),
  };
}

/**
 * - none: nothing was written in Korean
 * - done: Korean answers were translated into English
 * - failed: translation did not succeed for at least one answer
 * - unavailable: no model is configured, so nothing could be translated
 *
 * Whatever the status, no Korean answer is ever placed in the letter: an
 * answer that could not be translated becomes a fill-in blank.
 */
type TranslationStatus = "none" | "done" | "failed" | "unavailable";

export async function POST(req: Request) {
  let body: { analysis?: unknown; facts?: unknown; today?: unknown };
  try {
    body = await req.json();
  } catch {
    return bad("bad_json");
  }
  if (!body.analysis || typeof body.analysis !== "object" || !body.facts || typeof body.facts !== "object") {
    return bad("missing");
  }
  const today = typeof body.today === "string" && parseIso(body.today) !== null ? body.today : new Date().toISOString().slice(0, 10);

  const rawAnalysis = body.analysis as Record<string, unknown>;
  let analysis: DenialAnalysis = { ...coerceAnalysis(rawAnalysis), source: rawAnalysis.source === "rules" ? "rules" : "ai" };
  let facts = coerceFacts(body.facts as Record<string, unknown>);

  // The letter is always English: translate Korean answers, never names.
  const named = dropKoreanNames(analysis, facts);
  analysis = named.analysis;
  facts = named.facts;

  const korean = koreanFields(analysis, facts);
  let translation: TranslationStatus = "none";
  if (Object.keys(korean).length) {
    if (!hasModel()) {
      translation = "unavailable";
    } else {
      const result = await translateToEnglish(korean as Record<string, string>);
      ({ analysis, facts } = applyTranslations(analysis, facts, result.translated));
      translation = result.failed.length ? "failed" : "done";
    }
    ({ analysis, facts } = blankUntranslated(analysis, facts));
  }

  let tailoredArguments: string[] | undefined;
  let tailored = false;
  const translatedOk = translation === "none" || translation === "done";
  const hasStory = (facts.whyNeeded + facts.whatTried + facts.harmIfDelayed).replace(/\[[^\]]*\]/g, "").trim().length > 30;
  if (hasModel() && hasStory && translatedOk) {
    try {
      tailoredArguments = await draftArgumentsWithModel(analysis, facts);
      tailored = true;
    } catch (err) {
      console.error("draft failed, using template:", err instanceof Error ? err.message : err);
    }
  }

  return Response.json({
    letter: buildLetter({ analysis, facts, today, tailoredArguments }),
    tailored,
    translation,
    namesDropped: named.dropped,
  });
}
