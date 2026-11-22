import type { DenialCategory } from "./types";

export interface CategoryInfo {
  label: string;
  /** What this kind of denial means, in plain language. */
  meaning: string;
  /** What usually wins this kind of appeal. */
  whatHelps: string;
  /** Evidence worth gathering before sending. */
  evidence: string[];
  /** Argument paragraphs used when no model is available to tailor them. */
  arguments: string[];
  /** Keyword patterns for the offline reader, with weights. */
  signals: [RegExp, number][];
}

const FOLLOW_MEDICARE =
  "Medicare Advantage plans are required to cover the items and services that Original Medicare covers and to follow Medicare's coverage rules, including National and Local Coverage Determinations (42 C.F.R. § 422.101(b)). A plan may apply its own internal coverage criteria only where Medicare's coverage criteria are not fully established, and those criteria must be publicly available and based on current evidence (42 C.F.R. § 422.101(b)(6)). I ask that you identify the specific Medicare coverage rule or plan criterion relied on for this denial and explain how my records fail to meet it.";

export const CATEGORIES: Record<DenialCategory, CategoryInfo> = {
  medical_necessity: {
    label: "Not medically necessary",
    meaning:
      "The plan agrees this is a kind of care it covers, but says the records it reviewed do not show that you need it. This is a judgment call about your situation, not a rule that the care is never covered.",
    whatHelps:
      "A letter from the treating doctor explaining why this care is needed for you specifically, with the records that back it up. Denials like this are often made from a thin file.",
    evidence: [
      "A letter of medical necessity from the treating doctor",
      "Recent visit notes, test results or imaging reports",
      "A list of treatments already tried and how they went",
      "The plan's coverage policy named in the denial, if one is named",
    ],
    arguments: [
      "The denial states that the requested care is not medically necessary. My treating physician, who has examined me and knows my history, has determined that it is. The enclosed records document my condition, the treatments already attempted, and why this care is appropriate for me now.",
      FOLLOW_MEDICARE,
    ],
    signals: [
      [/not\s+medically\s+necessary/i, 5],
      [/medical(ly)?\s+necess/i, 3],
      [/does\s+not\s+meet\s+(the\s+)?(clinical\s+)?criteria/i, 3],
      [/clinical\s+(guidelines?|criteria)/i, 1],
      [/(interqual|mcg|milliman)/i, 2],
    ],
  },
  level_of_care: {
    label: "A lower level of care was approved instead",
    meaning:
      "The plan is not saying you need no care. It is saying the setting that was requested (for example an inpatient rehab hospital or a skilled nursing stay) is more than you need, and that a less intensive setting such as home health or outpatient therapy would do.",
    whatHelps:
      "Specifics about why the lower level of care is not safe or workable: what help is needed day to day, what the therapists and doctor recommend, and what would go wrong at home..",
    evidence: [
      "The treating doctor's or hospital team's recommendation for this setting",
      "Physical and occupational therapy evaluations",
      "Notes on how much help is needed with walking, transfers, bathing and medications",
      "A short description of the home situation (stairs, who is there to help, hours alone)",
    ],
    arguments: [
      "The denial concludes that a lower level of care would be sufficient. That conclusion is not consistent with the assessment of the clinicians who are treating me. The enclosed records describe my current functional status, the skilled services I need, and why those services cannot safely be provided in a less intensive setting.",
      "When deciding whether to cover a skilled nursing facility stay, inpatient rehabilitation or home health services, a Medicare Advantage plan must apply the same coverage criteria that Original Medicare applies and may not deny that care on the basis of internal criteria that are more restrictive (42 C.F.R. § 422.101(b) and (c)). I ask that you identify which Medicare criterion you believe is not met and the evidence for that conclusion.",
    ],
    signals: [
      [/skilled\s+nursing/i, 3],
      [/inpatient\s+rehab/i, 3],
      [/acute\s+rehab/i, 3],
      [/lower\s+level\s+of\s+care/i, 5],
      [/level\s+of\s+care/i, 3],
      [/(can|could)\s+be\s+(safely\s+)?(provided|treated|managed)\s+(at\s+home|in\s+an?\s+outpatient)/i, 4],
      [/home\s+health/i, 1],
      [/observation/i, 1],
    ],
  },
  out_of_network: {
    label: "Out-of-network provider",
    meaning:
      "The plan is denying this because the doctor or facility is not in its network, and it believes an in-network provider can deliver the same care.",
    whatHelps:
      "Showing that no in-network provider can reasonably provide this care: none nearby, none with the needed expertise, none with a timely appointment. Plans must arrange out-of-network care when their network cannot meet your needs.",
    evidence: [
      "Names of in-network providers you contacted, with dates and what they said",
      "Wait times or distances for the in-network options",
      "A note from your doctor on why this particular provider is needed",
    ],
    arguments: [
      "The denial is based on the provider being outside the plan's network. A Medicare Advantage plan must maintain a network sufficient to provide adequate access to covered services, and must arrange for specialty care outside the network when network providers are unavailable or inadequate to meet an enrollee's medical needs (42 C.F.R. § 422.112(a)). As described above, the in-network options offered to me cannot provide this care in a reasonable time or distance, or do not have the necessary expertise.",
    ],
    signals: [
      [/out[-\s]of[-\s]network/i, 5],
      [/non[-\s]?(contract(ed)?|participating)/i, 4],
      [/not\s+(in|within)\s+(our|the|your\s+plan'?s?)\s+network/i, 5],
      [/in[-\s]network\s+provider/i, 2],
    ],
  },
  not_covered: {
    label: "Not a covered benefit",
    meaning:
      "The plan says this item or service is not part of what it covers at all, whatever your medical situation.",
    whatHelps:
      "Checking whether Original Medicare covers it. A Medicare Advantage plan has to cover everything Original Medicare covers, so if Medicare covers this, the plan generally must too. Your plan's Evidence of Coverage booklet lists what is covered.",
    evidence: [
      "The page of your Evidence of Coverage that describes this benefit",
      "Any Medicare coverage rule your doctor's office can point to for this service",
      "A letter from your doctor describing exactly what was ordered and why",
    ],
    arguments: [
      "The denial states that the requested item or service is not a covered benefit. Medicare Advantage plans must provide coverage of all items and services covered under Medicare Parts A and B (42 C.F.R. § 422.101(a)). I believe this service is covered by Original Medicare for a patient in my circumstances, and I ask that you identify the specific exclusion in my Evidence of Coverage or the Medicare rule you are relying on.",
    ],
    signals: [
      [/not\s+a\s+covered\s+(benefit|service|item)/i, 5],
      [/benefit\s+exclusion/i, 4],
      [/exclu(ded|sion)/i, 2],
      [/not\s+covered\s+(under|by)\s+(your|the)\s+plan/i, 4],
      [/evidence\s+of\s+coverage/i, 1],
    ],
  },
  missing_info: {
    label: "Not enough information",
    meaning:
      "The plan says it did not get the records it needed to approve this. It has not decided you do not need the care; it decided it could not tell.",
    whatHelps:
      "Getting the missing records to the plan. This is frequently the quickest kind of denial to fix. Call the doctor's office, tell them what the letter says was missing, and ask them to send it or give you copies to include.",
    evidence: [
      "Exactly the records the denial says were missing",
      "Recent visit notes and test results",
      "A short cover note from the doctor's office tying the records to this request",
    ],
    arguments: [
      "The denial states that the plan did not receive sufficient clinical information to approve the request. The information identified as missing is enclosed with this appeal. With these records, the request can be evaluated on its merits, and I ask that it be approved.",
      "If any further information is needed, please contact my treating physician directly rather than denying the request, as the plan is expected to make reasonable efforts to obtain needed documentation.",
    ],
    signals: [
      [/(insufficient|lack\s+of|not\s+enough|inadequate)\s+(clinical\s+)?(information|documentation)/i, 5],
      [/did\s+not\s+receive\s+(the\s+)?(requested\s+)?(information|records|documentation)/i, 5],
      [/additional\s+(information|records|documentation)\s+(was|is|were)\s+(requested|needed|required)/i, 4],
      [/unable\s+to\s+determine/i, 2],
    ],
  },
  step_therapy: {
    label: "Try something else first",
    meaning:
      "The plan wants you to try a different, usually cheaper, treatment or drug before it will approve this one.",
    whatHelps:
      "Showing that the other treatment was already tried and did not work, caused side effects, or is unsafe for you. The doctor's office usually has this history in the chart.",
    evidence: [
      "Dates and results of the treatments already tried",
      "Any side effects or reasons the required alternative is unsafe for you",
      "A statement from the doctor on why this treatment is needed now",
    ],
    arguments: [
      "The denial requires that a different treatment be tried first. As described above and documented in the enclosed records, the preferred alternative has already been tried without adequate result, is contraindicated for me, or is expected to be ineffective or harmful given my history. My physician supports an exception to the plan's step requirement for these reasons.",
    ],
    signals: [
      [/step\s+therapy/i, 5],
      [/(must|should)\s+(first\s+)?(try|have\s+tried)/i, 4],
      [/trial\s+(and\s+failure\s+)?of/i, 3],
      [/preferred\s+(drug|product|alternative|agent)/i, 3],
      [/conservative\s+(treatment|therapy|management)/i, 3],
      [/physical\s+therapy\s+(for|has\s+not)/i, 1],
    ],
  },
  experimental: {
    label: "Experimental or investigational",
    meaning:
      "The plan says this treatment is not yet proven enough to be covered for your condition.",
    whatHelps:
      "Evidence that the treatment is accepted practice: a Medicare coverage rule that covers it, FDA approval for this use, or professional guidelines. This usually needs your doctor's help.",
    evidence: [
      "A doctor's letter citing guidelines or studies supporting this treatment",
      "FDA approval information for this use, if it is a drug or device",
      "Any Medicare coverage rule that applies",
    ],
    arguments: [
      "The denial characterizes the requested treatment as experimental or investigational. My physician's enclosed letter explains that this treatment is an accepted standard of care for my condition and cites the supporting clinical guidelines and evidence.",
      FOLLOW_MEDICARE,
    ],
    signals: [
      [/experimental/i, 5],
      [/investigational/i, 5],
      [/unproven/i, 3],
      [/not\s+(fda|food\s+and\s+drug)/i, 3],
    ],
  },
  other: {
    label: "Another reason",
    meaning:
      "The reason in this letter does not fit one of the common patterns. Read the plan's explanation closely; the letter is required to give the specific reason and the rule it relied on.",
    whatHelps:
      "Answering the plan's stated reason directly, with records from the treating doctor. If the reason is unclear, call the number on the notice and ask them to explain it, and write down who you spoke to and when.",
    evidence: [
      "A letter from the treating doctor responding to the plan's stated reason",
      "Relevant medical records",
      "Notes from any phone calls with the plan (date, name, what was said)",
    ],
    arguments: [
      "I disagree with the reason given for this denial. The enclosed records and my physician's statement show that the requested care is appropriate and should be covered under my plan.",
      FOLLOW_MEDICARE,
    ],
    signals: [],
  },
};
