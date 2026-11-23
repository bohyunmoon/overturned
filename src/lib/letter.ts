import { CATEGORIES } from "./categories";
import { daysBetween, formatDate, planDecisionWindow } from "./deadlines";
import { RULES } from "./rules";
import type { DenialAnalysis, UserFacts } from "./types";

/** A blank the user must fill in by hand. Kept loud so it is hard to miss. */
const blank = (what: string) => `[${what.toUpperCase()}]`;
const or = (value: string, what: string) => (value.trim() ? value.trim() : blank(what));

export interface LetterInput {
  analysis: DenialAnalysis;
  facts: UserFacts;
  /** ISO date printed on the letter. */
  today: string;
  /** Tailored argument paragraphs from a model. Falls back to templates. */
  tailoredArguments?: string[];
}

/** The user's own account, in their words, assembled into paragraphs. */
export function factParagraphs(facts: UserFacts): string[] {
  const out: string[] = [];
  if (facts.whyNeeded.trim()) out.push(facts.whyNeeded.trim());
  if (facts.whatTried.trim()) out.push(`Treatments and steps already tried: ${facts.whatTried.trim()}`);
  if (facts.harmIfDelayed.trim()) out.push(`If this care is delayed or not provided: ${facts.harmIfDelayed.trim()}`);
  return out;
}

export function buildLetter({ analysis: a, facts: f, today, tailoredArguments }: LetterInput): string {
  const patient = or(f.patientName || a.memberName, "patient's full name");
  const isRep = f.signer === "representative";
  const signerName = isRep ? or(f.representativeName, "your full name") : patient;
  const plan = or(a.planName, "plan name");
  const serviceLabel = or(a.serviceDenied, "the service or item that was denied");
  // Mid-sentence form: "Inpatient rehab admission" reads better lowercased, "MRI of the spine" does not.
  const service = /^[A-Z][a-z]/.test(serviceLabel) ? serviceLabel[0].toLowerCase() + serviceLabel.slice(1) : serviceLabel;
  const noticeDate = a.noticeDate ? formatDate(a.noticeDate) : blank("date on the denial notice");
  const late = a.noticeDate ? daysBetween(a.noticeDate, today) > RULES.daysToFileReconsideration : false;
  const kind = f.expedited ? "expedited (fast)" : "standard";
  const me = isRep ? `${patient}` : "me";
  const my = isRep ? `${patient}'s` : "my";

  const lines: string[] = [];
  const p = (...s: string[]) => lines.push(...s, "");

  p(signerName, or(f.mailingAddress, "your mailing address"), or(f.phone, "your phone number"));
  p(formatDate(today));
  p(
    plan,
    "Appeals and Grievances Department",
    or(a.appealAddress, "appeals address from the denial notice"),
    ...(a.appealFax ? [`Fax: ${a.appealFax}`] : []),
  );

  p(
    `RE: Request for ${f.expedited ? "EXPEDITED " : ""}Reconsideration (Appeal)`,
    `Enrollee: ${patient}`,
    `Member ID: ${or(a.memberId, "member ID")}`,
    ...(a.referenceNumber ? [`Reference number: ${a.referenceNumber}`] : []),
    `Service denied: ${serviceLabel}`,
    `Date of denial notice: ${noticeDate}`,
    ...(f.doctorName.trim() || a.providerName ? [`Treating provider: ${f.doctorName.trim() || a.providerName}`] : []),
  );

  p("To Whom It May Concern:");

  p(
    isRep
      ? `I am the appointed representative of ${patient}, an enrollee in ${plan}. On ${patient}'s behalf, I am requesting a ${kind} reconsideration of the plan's decision dated ${noticeDate} to deny coverage of ${service}. A signed Appointment of Representative form (CMS-1696) or equivalent written authorization is enclosed.`
      : `I am an enrollee in ${plan}. I am requesting a ${kind} reconsideration of the plan's decision dated ${noticeDate} to deny coverage of ${service}.`,
  );

  if (late) {
    p(
      `I recognize this request is being filed more than ${RULES.daysToFileReconsideration} days after the date of the notice. I ask that you accept it for good cause for the following reason: ${or(f.lateReason, "explain why you could not file sooner, for example serious illness, a death in the family, or not receiving the notice")}.`,
    );
  } else {
    p(`This request is timely. It is filed within ${RULES.daysToFileReconsideration} calendar days of the date of the denial notice.`);
  }

  if (a.statedReason.trim()) {
    p(`The notice gives this reason for the denial: "${a.statedReason.trim().replace(/"/g, "'")}" I disagree, for the reasons below.`);
  }

  p("WHY THIS DENIAL SHOULD BE OVERTURNED");

  const facts = factParagraphs(f);
  if (facts.length) {
    for (const para of facts) p(para);
  } else {
    p(blank(`describe in your own words why ${me === "me" ? "you need" : patient + " needs"} this care`));
  }

  if (f.doctorSupports) {
    p(
      `${or(f.doctorName || a.providerName, "doctor's name")}, the treating physician, supports this appeal. A letter explaining why this care is medically necessary${isRep ? "" : " for me"} is enclosed.`,
    );
  }

  // Follow-up answers are woven into tailored arguments by the model. With
  // the standard wording they are added as the person's own statements.
  if (!tailoredArguments?.length) for (const x of f.extra) p(x.answer);

  const args = tailoredArguments?.length ? tailoredArguments : CATEGORIES[a.category].arguments;
  for (const para of args) p(isRep ? toThirdPerson(para, patient) : para);

  if (f.expedited) {
    p(
      `REQUEST FOR EXPEDITED REVIEW`,
    );
    p(
      `I ask that this appeal be decided on an expedited basis, within ${RULES.planDecision.expeditedHours} hours. Waiting for a standard decision could seriously jeopardize ${my} life, health, or ability to regain maximum function. ${f.harmIfDelayed.trim() ? "" : blank("explain what could happen during a 30-day wait") + " "}If ${my} physician requests or supports expedited review, the plan is required to grant it.`,
    );
  }

  p("WHAT I AM REQUESTING");
  p(
    `1. That the plan reverse its decision and approve coverage of ${service}.`,
    `2. That this reconsideration be decided by a physician with expertise appropriate to the care at issue who was not involved in the original denial.`,
    `3. A copy of ${my} case file, including the specific Medicare coverage rule or plan criteria used to make the original decision.`,
    `4. A written decision within ${planDecisionWindow(a.requestType, f.expedited)} of your receipt of this request, as Medicare rules require.`,
  );

  p(
    `If the plan does not reverse its decision in full, I understand that it must forward ${my} case automatically to Medicare's Independent Review Entity for a new, independent decision.`,
  );

  p(`Please contact me at ${or(f.phone, "your phone number")} if you need anything further.`);

  p("Sincerely,", "", "", signerName, ...(isRep ? [`Appointed representative for ${patient}`] : []));

  const enclosures = [
    "Copy of the denial notice",
    ...(f.doctorSupports ? ["Letter of medical necessity from the treating physician"] : []),
    "Supporting medical records",
    ...(isRep ? ["Appointment of Representative form (CMS-1696) or equivalent"] : []),
  ];
  lines.push("Enclosures:", ...enclosures.map((e) => `  - ${e}`));

  return lines.join("\n");
}

/**
 * Template arguments are written in the first person. When a representative
 * signs, rewrite the common first-person forms to refer to the patient.
 */
export function toThirdPerson(text: string, patient: string): string {
  return text
    .replace(/\bMy treating physician\b/g, `${patient}'s treating physician`)
    .replace(/\bMy physician\b/g, `${patient}'s physician`)
    .replace(/\bmy treating physician\b/g, `${patient}'s treating physician`)
    .replace(/\bmy physician\b/g, `${patient}'s physician`)
    .replace(/\bmy Evidence of Coverage\b/g, `${patient}'s Evidence of Coverage`)
    .replace(/\bmy (records|condition|history|current functional status|circumstances)\b/g, `${patient}'s $1`)
    .replace(/\bhas examined me and knows my history\b/g, `has examined ${patient} and knows the history`)
    .replace(/\b(appropriate|contraindicated|offered) (for|to) me\b/g, `$1 $2 ${patient}`)
    .replace(/\bwho are treating me\b/g, `who are treating ${patient}`)
    .replace(/\bskilled services I need\b/g, `skilled services ${patient} needs`)
    .replace(/\bfor a patient in my circumstances\b/g, `for a patient in ${patient}'s circumstances`)
    .replace(/\bgiven my history\b/g, `given ${patient}'s history`)
    .replace(/\bfor me\b/g, `for ${patient}`);
}
