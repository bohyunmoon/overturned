export type Locale = "en" | "ko";

/** True when the text contains Korean (Hangul) characters. */
export function hasHangul(text: string): boolean {
  return /[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7A3]/.test(text);
}

export type DenialCategory =
  | "medical_necessity"
  | "level_of_care"
  | "out_of_network"
  | "not_covered"
  | "missing_info"
  | "step_therapy"
  | "experimental"
  | "other";

export const DENIAL_CATEGORIES: DenialCategory[] = [
  "medical_necessity",
  "level_of_care",
  "out_of_network",
  "not_covered",
  "missing_info",
  "step_therapy",
  "experimental",
  "other",
];

/** Part B drugs have shorter plan decision clocks than other items/services. */
export type RequestType = "service" | "part_b_drug";

export interface DenialAnalysis {
  category: DenialCategory;
  confidence: "high" | "medium" | "low";
  /** Does this look like a Medicare Advantage pre-service (prior auth) denial? */
  inScope: boolean;
  requestType: RequestType;
  planName: string;
  memberName: string;
  memberId: string;
  referenceNumber: string;
  serviceDenied: string;
  providerName: string;
  /** ISO yyyy-mm-dd, or "" if it could not be read. */
  noticeDate: string;
  /** The plan's own stated reason, briefly. */
  statedReason: string;
  /** Plain-language explanation written for a non-expert, in `lang`. */
  plainSummary: string;
  /** Language plainSummary and warnings were written in. */
  lang: Locale;
  appealAddress: string;
  appealFax: string;
  appealPhone: string;
  /**
   * Things to double check. The offline reader emits codes ("code:not_ma")
   * that the interface translates; the model writes sentences in `lang`.
   */
  warnings: string[];
  /** "ai" when a model read the letter, "rules" for the offline keyword reader. */
  source: "ai" | "rules";
}

export interface UserFacts {
  /** Who signs the letter. */
  signer: "patient" | "representative";
  patientName: string;
  representativeName: string;
  mailingAddress: string;
  phone: string;
  doctorName: string;
  doctorSupports: boolean;
  whyNeeded: string;
  whatTried: string;
  harmIfDelayed: string;
  expedited: boolean;
  /** Only used when the 65-day window has passed. */
  lateReason: string;
  /** Answers to follow-up questions asked on the draft screen. */
  extra: ExtraAnswer[];
}

export interface ExtraAnswer {
  /** The question, in English, so the drafting model knows what was asked. */
  question: string;
  answer: string;
}

export const EMPTY_FACTS: UserFacts = {
  signer: "patient",
  patientName: "",
  representativeName: "",
  mailingAddress: "",
  phone: "",
  doctorName: "",
  doctorSupports: false,
  whyNeeded: "",
  whatTried: "",
  harmIfDelayed: "",
  expedited: false,
  lateReason: "",
  extra: [],
};
