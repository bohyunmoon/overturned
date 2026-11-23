import type { DenialAnalysis, UserFacts } from "./types";

/**
 * A blank in the letter, like [YOUR PHONE NUMBER], is never something the
 * person should have to fix by editing English text. Each one is turned back
 * into a question on the draft screen, in the person's language, and the
 * answer is put into the letter for them.
 *
 * This file maps the blanks the letter template can produce to the piece of
 * information that fills them. Blanks written by the model come with their
 * own questions (see LetterQuestion).
 */

export const BLANK_PATTERN = /\[[A-Z][^\]\n]{2,}\]/g;

export type KnownField =
  | { scope: "facts"; key: "patientName" | "representativeName" | "doctorName"; input: "name" }
  | { scope: "facts"; key: "mailingAddress"; input: "address" }
  | { scope: "facts"; key: "phone"; input: "tel" }
  | { scope: "facts"; key: "whyNeeded" | "whatTried" | "harmIfDelayed" | "lateReason"; input: "long" }
  | { scope: "analysis"; key: "planName"; input: "name" }
  | { scope: "analysis"; key: "serviceDenied" | "memberId"; input: "text" }
  | { scope: "analysis"; key: "appealAddress"; input: "address" }
  | { scope: "analysis"; key: "noticeDate"; input: "date" };

const facts = <K extends Extract<KnownField, { scope: "facts" }>["key"]>(key: K, input: KnownField["input"]) =>
  ({ scope: "facts", key, input }) as KnownField;
const analysis = <K extends Extract<KnownField, { scope: "analysis" }>["key"]>(key: K, input: KnownField["input"]) =>
  ({ scope: "analysis", key, input }) as KnownField;

/** Order matters: the first pattern that matches wins. */
const KNOWN: [RegExp, KnownField][] = [
  [/^\[PATIENT'S FULL NAME\]$/, facts("patientName", "name")],
  [/^\[YOUR FULL NAME\]$/, facts("representativeName", "name")],
  [/^\[DOCTOR'S NAME\]$/, facts("doctorName", "name")],
  [/^\[YOUR MAILING ADDRESS\]$/, facts("mailingAddress", "address")],
  [/^\[YOUR PHONE NUMBER\]$/, facts("phone", "tel")],
  [/^\[PLAN NAME\]$/, analysis("planName", "name")],
  [/^\[THE SERVICE OR ITEM THAT WAS DENIED\]$/, analysis("serviceDenied", "text")],
  [/^\[MEMBER ID\]$/, analysis("memberId", "text")],
  [/^\[APPEALS ADDRESS FROM THE DENIAL NOTICE\]$/, analysis("appealAddress", "address")],
  [/^\[DATE ON THE DENIAL NOTICE\]$/, analysis("noticeDate", "date")],
  [/^\[DESCRIBE IN YOUR OWN WORDS WHY /, facts("whyNeeded", "long")],
  [/^\[EXPLAIN WHY YOU COULD NOT FILE SOONER/, facts("lateReason", "long")],
  [/^\[EXPLAIN WHAT COULD HAPPEN DURING /, facts("harmIfDelayed", "long")],
  // Answers that could not be translated: ask again rather than leave a blank.
  [/^\[WRITE IN ENGLISH: WHY THIS CARE IS NEEDED\]$/, facts("whyNeeded", "long")],
  [/^\[WRITE IN ENGLISH: WHAT HAS ALREADY BEEN TRIED\]$/, facts("whatTried", "long")],
  [/^\[WRITE IN ENGLISH: WHAT HAPPENS IF THIS CARE IS DELAYED\]$/, facts("harmIfDelayed", "long")],
  [/^\[WRITE IN ENGLISH: WHY THE APPEAL IS LATE\]$/, facts("lateReason", "long")],
];

export function resolveBlank(token: string): KnownField | null {
  for (const [re, field] of KNOWN) if (re.test(token)) return field;
  return null;
}

/** A question the model asked because it needed a fact it was not given. */
export interface LetterQuestion {
  /** The exact bracketed blank in the letter this question fills. */
  blank: string;
  en: string;
  ko: string;
}

export type Needed =
  | { kind: "known"; id: string; field: KnownField }
  | { kind: "question"; id: string; blank: string; question: LetterQuestion | null };

/** Everything the letter still needs, in the order it appears, without repeats. */
export function neededFromLetter(letter: string, questions: LetterQuestion[]): Needed[] {
  const out: Needed[] = [];
  const seen = new Set<string>();
  for (const token of letter.match(BLANK_PATTERN) ?? []) {
    const field = resolveBlank(token);
    const id = field ? `${field.scope}.${field.key}` : token;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(
      field
        ? { kind: "known", id, field }
        : { kind: "question", id, blank: token, question: questions.find((q) => q.blank === token) ?? null },
    );
  }
  return out;
}

export function fieldValue(field: KnownField, a: DenialAnalysis, f: UserFacts): string {
  return field.scope === "facts" ? f[field.key] : a[field.key];
}
