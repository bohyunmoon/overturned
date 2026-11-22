import { RULES } from "./rules";
import type { RequestType } from "./types";

const DAY_MS = 86_400_000;
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parse yyyy-mm-dd as a UTC midnight timestamp. Returns null if invalid. */
export function parseIso(iso: string): number | null {
  const m = ISO.exec(iso);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = Date.UTC(y, mo - 1, d);
  const back = new Date(t);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) {
    return null; // e.g. 2026-02-31
  }
  return t;
}

export function toIso(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const t = parseIso(iso);
  if (t === null) throw new Error(`Invalid date: ${iso}`);
  return toIso(t + days * DAY_MS);
}

/** Whole calendar days from a to b (positive when b is later). */
export function daysBetween(a: string, b: string): number {
  const ta = parseIso(a);
  const tb = parseIso(b);
  if (ta === null || tb === null) throw new Error("Invalid date");
  return Math.round((tb - ta) / DAY_MS);
}

/** Today's date in the user's own timezone, as yyyy-mm-dd. */
export function localToday(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatLong(iso: string): string {
  const t = parseIso(iso);
  if (t === null) return iso;
  return new Date(t).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export type FilingStatus = "ok" | "soon" | "urgent" | "overdue";

export interface FilingDeadline {
  fileBy: string;
  daysLeft: number;
  status: FilingStatus;
  /** True when the deadline lands on a Saturday or Sunday. */
  fallsOnWeekend: boolean;
}

/**
 * The plan must receive the reconsideration request within 65 calendar days
 * of the date on the denial notice.
 */
export function filingDeadline(noticeDate: string, today: string): FilingDeadline {
  const fileBy = addDays(noticeDate, RULES.daysToFileReconsideration);
  const daysLeft = daysBetween(today, fileBy);
  const status: FilingStatus =
    daysLeft < 0 ? "overdue" : daysLeft <= 7 ? "urgent" : daysLeft <= 21 ? "soon" : "ok";
  const dow = new Date(parseIso(fileBy)!).getUTCDay();
  return { fileBy, daysLeft, status, fallsOnWeekend: dow === 0 || dow === 6 };
}

/** How long the plan has to answer once it receives the appeal, in words. */
export function planDecisionWindow(requestType: RequestType, expedited: boolean): string {
  const p = RULES.planDecision;
  if (expedited) return `${p.expeditedHours} hours`;
  return requestType === "part_b_drug" ? `${p.partBDrugDays} calendar days` : `${p.serviceDays} calendar days`;
}

/**
 * Latest date a standard decision is due, given the date the plan received
 * the appeal. Expedited appeals run on a 72-hour clock, so we return the
 * date three days out as the outer bound.
 */
export function planDecisionDue(receivedDate: string, requestType: RequestType, expedited: boolean): string {
  const p = RULES.planDecision;
  if (expedited) return addDays(receivedDate, 3);
  return addDays(receivedDate, requestType === "part_b_drug" ? p.partBDrugDays : p.serviceDays);
}

export interface Stage {
  level: number;
  name: string;
  who: string;
  youMustFile: boolean;
  timing: string;
  note: string;
}

export function appealStages(requestType: RequestType, expedited: boolean): Stage[] {
  const window = planDecisionWindow(requestType, expedited);
  const aic = RULES.amountInControversy;
  const ext =
    requestType === "service"
      ? ` The plan can take up to ${RULES.planDecision.extensionDays} extra days in limited cases, and must tell you in writing if it does.`
      : "";
  return [
    {
      level: 1,
      name: "Plan reconsideration",
      who: "Your Medicare Advantage plan",
      youMustFile: true,
      timing: `File within ${RULES.daysToFileReconsideration} calendar days of the date on the denial notice. The plan then has ${window} to decide.`,
      note: `This is the appeal this letter starts.${ext}`,
    },
    {
      level: 2,
      name: "Independent review",
      who: "Independent Review Entity (an outside reviewer hired by Medicare)",
      youMustFile: false,
      timing: `Automatic. If the plan says no again, it must send your case to the independent reviewer itself. The reviewer has ${window} to decide.`,
      note: "You do not need to file anything, but you can send the reviewer extra evidence. The plan's letter will tell you how.",
    },
    {
      level: 3,
      name: "Administrative Law Judge hearing",
      who: "Office of Medicare Hearings and Appeals",
      youMustFile: true,
      timing: `Request within ${RULES.daysToRequestAlj} days of the independent reviewer's decision.`,
      note: `Only available if the care in dispute is worth at least $${aic.alj} (${aic.year} amount; it changes each year).`,
    },
    {
      level: 4,
      name: "Medicare Appeals Council",
      who: "Departmental Appeals Board",
      youMustFile: true,
      timing: `Request within ${RULES.daysToRequestCouncil} days of the judge's decision.`,
      note: "A paper review of the judge's decision.",
    },
    {
      level: 5,
      name: "Federal district court",
      who: "U.S. District Court",
      youMustFile: true,
      timing: `File within ${RULES.daysToFileCourt} days of the Council's decision.`,
      note: `Only if at least $${aic.federalCourt.toLocaleString("en-US")} is in dispute (${aic.year} amount). You would want a lawyer for this.`,
    },
  ];
}

/** "October 28, 2026", for use inside a letter. */
export function formatDate(iso: string): string {
  return formatLong(iso).replace(/^\w+, /, "");
}
