import { hasHangul, type DenialAnalysis, type UserFacts } from "./types";

/**
 * The appeal letter is always English. These helpers find what the person
 * typed in Korean and decide what to do with it:
 *
 * - Free-text answers are translated into English.
 * - Names are never translated or romanized. A name has to match the plan's
 *   records letter for letter, so a Korean name is dropped and the letter
 *   shows a blank for the person to fill in.
 * - Addresses are left exactly as typed.
 */

export const TRANSLATED_FACTS = ["whyNeeded", "whatTried", "harmIfDelayed", "lateReason"] as const;
export type TranslatableKey = (typeof TRANSLATED_FACTS)[number] | "serviceDenied";

/** The fields that contain Korean and need translating, keyed by name. */
export function koreanFields(analysis: DenialAnalysis, facts: UserFacts): Partial<Record<TranslatableKey, string>> {
  const out: Partial<Record<TranslatableKey, string>> = {};
  for (const k of TRANSLATED_FACTS) if (hasHangul(facts[k])) out[k] = facts[k];
  if (hasHangul(analysis.serviceDenied)) out.serviceDenied = analysis.serviceDenied;
  return out;
}

export function applyTranslations(
  analysis: DenialAnalysis,
  facts: UserFacts,
  translated: Partial<Record<TranslatableKey, string>>,
): { analysis: DenialAnalysis; facts: UserFacts } {
  const f = { ...facts };
  for (const k of TRANSLATED_FACTS) if (translated[k]) f[k] = translated[k]!;
  return {
    analysis: translated.serviceDenied ? { ...analysis, serviceDenied: translated.serviceDenied } : analysis,
    facts: f,
  };
}

const NAME_FACTS = ["patientName", "representativeName", "doctorName"] as const;
const NAME_DETAILS = ["planName", "memberName", "providerName"] as const;

/** Blank out names written in Korean so the letter shows a fill-in blank. */
export function dropKoreanNames(
  analysis: DenialAnalysis,
  facts: UserFacts,
): { analysis: DenialAnalysis; facts: UserFacts; dropped: boolean } {
  const a = { ...analysis };
  const f = { ...facts };
  let dropped = false;
  for (const k of NAME_FACTS) {
    if (hasHangul(f[k])) {
      f[k] = "";
      dropped = true;
    }
  }
  for (const k of NAME_DETAILS) {
    if (hasHangul(a[k])) {
      a[k] = "";
      dropped = true;
    }
  }
  return { analysis: a, facts: f, dropped };
}
