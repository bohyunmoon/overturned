/**
 * Medicare Advantage (Part C) appeal rules the app relies on.
 *
 * Every number here is a federal rule that CMS can change. Each one carries
 * the source it was checked against and the date it was checked, so a
 * maintainer can re-verify them in one pass. The dollar thresholds change
 * every calendar year.
 *
 * Last verified: 2026-11-22.
 */

export const RULES_VERIFIED_ON = "2026-11-22";

export const SOURCES = {
  medicareGovAppeals: {
    label: "Medicare.gov: Appeals in Medicare health plans",
    url: "https://www.medicare.gov/providers-services/claims-appeals-complaints/appeals/health-plans",
  },
  cmsReconsideration: {
    label: "CMS: Reconsideration by the Medicare Advantage (Part C) health plan",
    url: "https://www.cms.gov/medicare/appeals-grievances/managed-care/reconsideration-advantage-health-plan-part-c",
  },
  cmsIre: {
    label: "CMS: Reconsideration by the Part C Independent Review Entity",
    url: "https://www.cms.gov/medicare/appeals-grievances/managed-care/review-part-c-independent-entitiy",
  },
  cmsFlowchart: {
    label: "CMS: Part C appeals process flowchart (April 2026)",
    url: "https://www.hhs.gov/guidance/sites/default/files/hhs-guidance-documents/CMS/medicare-part-c-medicareadvantage-flowchart-042026v508.pdf",
  },
  ship: {
    label: "Find free local Medicare counseling (SHIP)",
    url: "https://www.shiphelp.org/",
  },
  aorForm: {
    label: "CMS-1696 Appointment of Representative form",
    url: "https://www.cms.gov/cms1696-appointment-representative",
  },
} as const;

export const RULES = {
  /** Calendar days from the date on the denial notice to ask the plan for a reconsideration. */
  daysToFileReconsideration: 65,
  /** Plan decision clocks, counted from when the plan receives the request. */
  planDecision: {
    expeditedHours: 72,
    serviceDays: 30,
    partBDrugDays: 7,
    /** Possible extension for item/service requests (not Part B drugs). */
    extensionDays: 14,
  },
  /** Days from the independent reviewer's decision to ask for an ALJ hearing. */
  daysToRequestAlj: 60,
  /** Days from the ALJ decision to ask for Medicare Appeals Council review. */
  daysToRequestCouncil: 60,
  /** Days from the Council decision to file in federal district court. */
  daysToFileCourt: 60,
  /** Minimum amount in controversy. Updated by CMS each calendar year. */
  amountInControversy: { year: 2026, alj: 200, federalCourt: 1960 },
} as const;
