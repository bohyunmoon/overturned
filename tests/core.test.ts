import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyByRules, findDates, findNoticeDate } from "../src/lib/classify";
import { addDays, daysBetween, filingDeadline, parseIso, planDecisionDue, planDecisionWindow } from "../src/lib/deadlines";
import { buildDeadlineIcs } from "../src/lib/export";
import { buildLetter } from "../src/lib/letter";
import { citesOnlyAllowed, coerceAnalysis } from "../src/lib/llm";
import { SAMPLE_LETTER } from "../src/lib/sample";
import { EMPTY_FACTS } from "../src/lib/types";

test("date maths is calendar-exact across months, years and leap days", () => {
  assert.equal(addDays("2026-10-28", 65), "2027-01-01");
  assert.equal(addDays("2028-02-28", 1), "2028-02-29");
  assert.equal(addDays("2027-02-28", 1), "2027-03-01");
  assert.equal(daysBetween("2026-11-22", "2027-01-01"), 40);
  assert.equal(parseIso("2026-02-31"), null);
  assert.equal(parseIso("not a date"), null);
});

test("filing deadline is 65 days from the notice date, with status bands", () => {
  const d = filingDeadline("2026-10-28", "2026-11-22");
  assert.deepEqual([d.fileBy, d.daysLeft, d.status, d.fallsOnWeekend], ["2027-01-01", 40, "ok", false]);
  assert.equal(filingDeadline("2026-10-28", "2026-12-15").status, "soon");
  assert.equal(filingDeadline("2026-10-28", "2026-12-28").status, "urgent");
  assert.equal(filingDeadline("2026-10-28", "2027-01-01").daysLeft, 0);
  assert.equal(filingDeadline("2026-10-28", "2027-01-01").status, "urgent");
  assert.equal(filingDeadline("2026-10-28", "2027-01-02").status, "overdue");
  assert.equal(filingDeadline("2026-10-29", "2026-11-01").fallsOnWeekend, true); // Sat 2027-01-02
});

test("plan decision windows follow request type and urgency", () => {
  assert.equal(planDecisionWindow("service", false), "30 calendar days");
  assert.equal(planDecisionWindow("part_b_drug", false), "7 calendar days");
  assert.equal(planDecisionWindow("service", true), "72 hours");
  assert.equal(planDecisionDue("2026-12-01", "service", false), "2026-12-31");
  assert.equal(planDecisionDue("2026-12-01", "part_b_drug", false), "2026-12-08");
  assert.equal(planDecisionDue("2026-12-01", "service", true), "2026-12-04");
});

test("dates are read in long and numeric forms; labeled notice date wins", () => {
  assert.deepEqual(findDates("Seen 3/4/2026 then Sept. 9, 2026 and 13/40/2026"), ["2026-03-04", "2026-09-09"]);
  assert.equal(findNoticeDate("Date of service: 10/01/2026\nDate of notice: October 28, 2026"), "2026-10-28");
  assert.equal(findNoticeDate("no dates here"), "");
});

test("offline reader handles the sample notice", () => {
  const a = classifyByRules(SAMPLE_LETTER);
  assert.equal(a.category, "level_of_care");
  assert.equal(a.noticeDate, "2026-10-28");
  assert.equal(a.inScope, true);
  assert.equal(a.memberName, "Margaret Sample");
  assert.equal(a.memberId, "XS4410927-01");
  assert.equal(a.referenceNumber, "PA-26-0098812");
  assert.match(a.serviceDenied, /^Inpatient rehabilitation facility admission/);
  assert.equal(a.appealFax, "800-555-0199");
  assert.match(a.statedReason, /not medically necessary/);
  assert.equal(a.source, "rules");
});

test("offline reader flags out-of-scope letters and classifies common reasons", () => {
  const eob = classifyByRules("Explanation of Benefits. Your claim was denied. Amount billed $400. The service is not a covered benefit under your plan.");
  assert.equal(eob.inScope, false);
  assert.equal(eob.category, "not_covered");
  assert.ok(eob.warnings.length >= 2);
  assert.equal(classifyByRules("Medicare Advantage. You must first try the preferred drug under our step therapy rules.").category, "step_therapy");
  assert.equal(classifyByRules("Medicare Advantage. The provider is out-of-network.").category, "out_of_network");
  assert.equal(classifyByRules("Medicare Advantage notice with nothing recognisable in it at all.").category, "other");
});

test("letter carries the facts, the request and loud blanks for anything missing", () => {
  const analysis = classifyByRules(SAMPLE_LETTER);
  const letter = buildLetter({ analysis, facts: { ...EMPTY_FACTS, whyNeeded: "Mom cannot climb the stairs to her bedroom." }, today: "2026-11-22" });
  assert.match(letter, /Enrollee: Margaret Sample/);
  assert.match(letter, /November 22, 2026/);
  assert.match(letter, /dated October 28, 2026 to deny coverage of inpatient rehabilitation/);
  assert.match(letter, /Service denied: Inpatient rehabilitation/);
  assert.match(letter, /inpatient rehabilitation facility\." I disagree/);
  assert.match(letter, /This request is timely/);
  assert.match(letter, /Mom cannot climb the stairs/);
  assert.match(letter, /within 30 calendar days of your receipt/);
  assert.match(letter, /\[YOUR MAILING ADDRESS\]/);
  assert.match(letter, /\[APPEALS ADDRESS FROM THE DENIAL NOTICE\]/);
  assert.doesNotMatch(letter, /undefined|null|NaN/);
});

test("representative, expedited and late variants", () => {
  const analysis = classifyByRules(SAMPLE_LETTER);
  const facts = { ...EMPTY_FACTS, signer: "representative" as const, representativeName: "Dana Sample", expedited: true, doctorSupports: true, doctorName: "Dr. Alan Example" };
  const letter = buildLetter({ analysis, facts, today: "2027-02-01" });
  assert.match(letter, /EXPEDITED Reconsideration/);
  assert.match(letter, /appointed representative of Margaret Sample/);
  assert.match(letter, /accept it for good cause/);
  assert.match(letter, /within 72 hours of your receipt/);
  assert.match(letter, /CMS-1696/);
  assert.match(letter, /clinicians who are treating Margaret Sample/);
  assert.doesNotMatch(letter, /treating me\b/);
});

test("model output is coerced and uncited authority is rejected", () => {
  const a = coerceAnalysis({ category: "nonsense", noticeDate: "10/28/2026", inScope: "yes", warnings: "x", planName: 7 });
  assert.deepEqual([a.category, a.noticeDate, a.inScope, a.warnings, a.planName], ["other", "", false, [], ""]);
  assert.equal(citesOnlyAllowed(["Per 42 C.F.R. § 422.101(b), the plan must follow Medicare rules."], "medical_necessity"), true);
  assert.equal(citesOnlyAllowed(["Per 42 C.F.R. § 999.123, you lose."], "medical_necessity"), false);
  assert.equal(citesOnlyAllowed(["As held in Smith v. Jones, the plan must pay."], "medical_necessity"), false);
});

test("calendar file is a valid all-day event on the deadline", () => {
  const ics = buildDeadlineIcs("2027-01-01", "Example Plan", "rehab; inpatient");
  assert.match(ics, /DTSTART;VALUE=DATE:20270101\r\n/);
  assert.match(ics, /DTEND;VALUE=DATE:20270102\r\n/);
  assert.match(ics, /rehab\\; inpatient/);
  assert.equal((ics.match(/BEGIN:VALARM/g) ?? []).length, 3);
});
