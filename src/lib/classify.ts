import { CATEGORIES } from "./categories";
import { toIso } from "./deadlines";
import type { DenialAnalysis, DenialCategory, RequestType } from "./types";

/**
 * Offline reader. Used when no model key is configured, and as the fallback
 * when a model call fails, so the product still works end to end. It reads
 * keywords and common notice layouts; it does not understand the letter.
 */

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

function isoFromParts(y: number, m: number, d: number): string {
  if (y < 100) y += 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return "";
  const t = Date.UTC(y, m - 1, d);
  return new Date(t).getUTCDate() === d ? toIso(t) : "";
}

/** All dates found in the text, in order of appearance, as ISO strings. */
export function findDates(text: string): string[] {
  const found: { at: number; iso: string }[] = [];
  const longForm = /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/gi;
  for (const m of text.matchAll(longForm)) {
    const key = m[1].toLowerCase().slice(0, 3);
    const month = MONTHS.findIndex((x) => x.startsWith(key)) + 1;
    const iso = isoFromParts(Number(m[3]), month, Number(m[2]));
    if (iso) found.push({ at: m.index ?? 0, iso });
  }
  const numeric = /\b(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})\b/g;
  for (const m of text.matchAll(numeric)) {
    const iso = isoFromParts(Number(m[3]), Number(m[1]), Number(m[2]));
    if (iso) found.push({ at: m.index ?? 0, iso });
  }
  return found.sort((a, b) => a.at - b.at).map((f) => f.iso);
}

/** Prefer a date explicitly labeled as the notice date; else the first date. */
export function findNoticeDate(text: string): string {
  const labeled = /(?:date\s+of\s+(?:this\s+)?(?:notice|letter|decision)|notice\s+date|date)\s*[:\-]\s*([^\n]{6,30})/i.exec(text);
  if (labeled) {
    const d = findDates(labeled[1]);
    if (d.length) return d[0];
  }
  return findDates(text)[0] ?? "";
}

function grab(text: string, re: RegExp, max = 140): string {
  const m = re.exec(text);
  return m ? m[1].trim().replace(/[,;:]+$/, "").slice(0, max) : "";
}

/** Trim to whole sentences so a quoted reason never stops mid-word. */
function wholeSentences(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const end = cut.lastIndexOf(". ");
  return end > 40 ? cut.slice(0, end + 1) : `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

export function scoreCategories(text: string): Record<DenialCategory, number> {
  const scores = {} as Record<DenialCategory, number>;
  for (const [key, info] of Object.entries(CATEGORIES) as [DenialCategory, (typeof CATEGORIES)[DenialCategory]][]) {
    scores[key] = info.signals.reduce((sum, [re, w]) => sum + (re.test(text) ? w : 0), 0);
  }
  return scores;
}

export function classifyByRules(text: string): DenialAnalysis {
  const scores = scoreCategories(text);
  const ranked = (Object.entries(scores) as [DenialCategory, number][]).sort((a, b) => b[1] - a[1]);
  const [top, second] = ranked;
  const category: DenialCategory = top[1] > 0 ? top[0] : "other";
  const confidence: DenialAnalysis["confidence"] =
    top[1] >= 5 && top[1] - second[1] >= 3 ? "medium" : "low";

  const looksMedicareAdvantage = /medicare\s+advantage|notice\s+of\s+denial\s+of\s+medical\s+coverage|organization\s+determination|\bpart\s+c\b|\b(hmo|ppo)\b.*medicare|medicare.*\b(hmo|ppo)\b/i.test(text);
  const looksPayment = /explanation\s+of\s+benefits|claim\s+(was\s+)?denied|denial\s+of\s+payment|amount\s+billed/i.test(text);
  const looksPartD = /\bpart\s+d\b|prescription\s+drug\s+(plan|coverage)\s+(denial|determination)|coverage\s+determination/i.test(text);
  const requestType: RequestType = /\bpart\s+b\s+(drug|medication)|infusion|injection\s+administered/i.test(text)
    ? "part_b_drug"
    : "service";

  const warnings: string[] = [];
  if (!looksMedicareAdvantage) {
    warnings.push("code:not_ma");
  }
  if (looksPayment) {
    warnings.push("code:payment");
  }
  if (looksPartD && !looksMedicareAdvantage) {
    warnings.push("code:part_d");
  }

  const noticeDate = findNoticeDate(text);
  if (!noticeDate) warnings.push("code:no_date");

  const statedReason = wholeSentences(grab(
    text,
    /(?:why\s+did\s+we\s+deny[^\n]*\n+|reason\s+for\s+(?:the\s+)?(?:denial|decision)\s*[:\-]?\s*|we\s+denied\s+(?:this|the|your)\s+[^.\n]{0,60}?\s+because\s+)([^\n]{15,600})/i,
    600,
  ), 320);

  return {
    category,
    confidence,
    inScope: looksMedicareAdvantage && !looksPayment,
    requestType,
    planName: grab(text, /^\s*([A-Z][A-Za-z&.' -]{2,60}(?:Medicare Advantage|Health Plan|Healthcare|Health|HMO|PPO)[A-Za-z&.' ()-]{0,30})\s*$/m),
    memberName: grab(text, /(?:member|enrollee|patient)(?:'s)?\s+name\s*[:\-]\s*([^\n]+)/i),
    memberId: grab(text, /(?:member|enrollee|subscriber)\s*(?:id|identification|number|no\.?|#)(?:\s*(?:number|no\.?|#))?\s*[:\-#]?\s*([A-Z0-9][A-Z0-9-]{4,20})/i),
    referenceNumber: grab(text, /(?:reference|case|authorization|auth|tracking|request)\s*(?:number|no\.?|#|id)\s*[:\-#]?\s*([A-Z0-9][A-Z0-9-]{3,24})/i),
    serviceDenied: grab(text, /(?:service(?:s)?(?:\/item)?\s+(?:requested|denied)|requested\s+service|item\s+or\s+service|we\s+(?:denied|will\s+not\s+(?:approve|cover|pay\s+for))\s+(?:the\s+)?(?:following\s+)?(?:medical\s+)?(?:service|item)s?(?:\/items?)?[^:\n]{0,80})\s*[:\-]\s*([^\n]+)/i),
    providerName: grab(text, /(?:requesting|ordering|treating|rendering)\s+(?:provider|physician|doctor)\s*[:\-]\s*([^\n]+)/i),
    noticeDate,
    statedReason,
    plainSummary: CATEGORIES[category].meaning,
    lang: "en",
    appealAddress: "",
    appealFax: grab(text, /fax(?:\s+(?:number|no\.?))?\s*[:\-]?\s*(\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/i),
    appealPhone: grab(text, /(?:call\s+(?:us\s+)?(?:at\s+)?|phone(?:\s+(?:number|no\.?))?\s*[:\-]?\s*)(1?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/i),
    warnings,
    source: "rules",
  };
}
