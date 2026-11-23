import { parseIso } from "@/lib/deadlines";
import { applyTranslations, blankUntranslated, dropKoreanNames, koreanFields } from "@/lib/korean";
import { guard } from "@/lib/guard";
import { buildLetter } from "@/lib/letter";
import { coerceAnalysis, draftArgumentsWithModel, hasModel, translateToEnglish } from "@/lib/llm";
import type { LetterQuestion } from "@/lib/blanks";
import { EMPTY_FACTS, hasHangul, type DenialAnalysis, type UserFacts } from "@/lib/types";

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
    extra: Array.isArray(raw.extra)
      ? (raw.extra as Record<string, unknown>[])
          .filter((x) => x && typeof x === "object")
          .map((x) => ({ question: s(x.question, 300), answer: s(x.answer, 1500).trim() }))
          .filter((x) => x.question && x.answer)
          .slice(0, 12)
      : [],
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
  const allowed = hasModel() ? await guard(req, "ai") : ({ ok: true, ai: false } as const);
  if (!allowed.ok) return bad("rate_limited", 429);
  const ai = allowed.ai; // false with no key, or once the site's daily AI cap is spent

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

  // Follow-up answers are translated alongside the main answers.
  const korean: Record<string, string> = { ...koreanFields(analysis, facts) };
  facts.extra.forEach((x, i) => {
    if (hasHangul(x.answer)) korean[`extra_${i}`] = x.answer;
  });
  let translation: TranslationStatus = "none";
  if (Object.keys(korean).length) {
    if (!ai) {
      translation = "unavailable";
    } else {
      const result = await translateToEnglish(korean);
      ({ analysis, facts } = applyTranslations(analysis, facts, result.translated));
      facts = { ...facts, extra: facts.extra.map((x, i) => ({ ...x, answer: result.translated[`extra_${i}`] ?? x.answer })) };
      translation = result.failed.length ? "failed" : "done";
    }
    ({ analysis, facts } = blankUntranslated(analysis, facts));
    // An untranslated follow-up answer is left out, so its question is simply asked again.
    facts = { ...facts, extra: facts.extra.filter((x) => !hasHangul(x.answer)) };
  }

  let tailoredArguments: string[] | undefined;
  let questions: LetterQuestion[] = [];
  let tailored = false;
  const translatedOk = translation === "none" || translation === "done";
  const hasStory = (facts.whyNeeded + facts.whatTried + facts.harmIfDelayed).replace(/\[[^\]]*\]/g, "").trim().length > 30;
  if (ai && hasStory && translatedOk) {
    try {
      ({ paragraphs: tailoredArguments, questions } = await draftArgumentsWithModel(analysis, facts));
      tailored = true;
    } catch (err) {
      console.error("draft failed, using template:", err instanceof Error ? err.message : err);
    }
  }

  return Response.json({
    letter: buildLetter({ analysis, facts, today, tailoredArguments }),
    tailored,
    questions,
    translation,
    namesDropped: named.dropped,
  });
}
