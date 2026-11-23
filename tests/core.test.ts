import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyByRules, findDates, findNoticeDate } from "../src/lib/classify";
import { addDays, daysBetween, filingDeadline, parseIso, planDecisionDue, planDecisionWindow } from "../src/lib/deadlines";
import { buildDeadlineIcs } from "../src/lib/export";
import { categoryText } from "../src/lib/categories.ko";
import { applyTranslations, blankUntranslated, dropKoreanNames, koreanFields } from "../src/lib/korean";
import { buildLetter } from "../src/lib/letter";
import { citesOnlyAllowed, classifyModelError, coerceAnalysis, questionsForBlanks, safeDetail, stripKoreanAsides } from "../src/lib/llm";
import { BLANK_PATTERN, neededFromLetter, resolveBlank } from "../src/lib/blanks";
import { capAlert, dayKey, dayOverDayAlert, guard, hourKey, isCheckpoint, MemoryStore, spikeAlert, visitorId, type CounterStore } from "../src/lib/guard";
import { SAMPLE_LETTER } from "../src/lib/sample";
import { DENIAL_CATEGORIES, EMPTY_FACTS, hasHangul } from "../src/lib/types";
import { CATEGORIES } from "../src/lib/categories";
import { appealStages, formatLong } from "../src/lib/deadlines";

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
  assert.deepEqual(eob.warnings, ["code:not_ma", "code:payment", "code:no_date"]);
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
  const ics = buildDeadlineIcs("2027-01-01", { summary: "마감일", description: "rehab; inpatient", alarm: (d) => `${d}일 전` });
  assert.match(ics, /SUMMARY:마감일/);
  assert.match(ics, /DESCRIPTION:21일 전/);
  assert.match(ics, /DTSTART;VALUE=DATE:20270101\r\n/);
  assert.match(ics, /DTEND;VALUE=DATE:20270102\r\n/);
  assert.match(ics, /rehab\\; inpatient/);
  assert.equal((ics.match(/BEGIN:VALARM/g) ?? []).length, 3);
});

test("Korean explanations cover every category and every appeal stage", () => {
  for (const c of DENIAL_CATEGORIES) {
    const ko = categoryText(c, "ko");
    const en = categoryText(c, "en");
    assert.ok(hasHangul(ko.label) && hasHangul(ko.meaning) && hasHangul(ko.whatHelps), c);
    assert.equal(ko.evidence.length, en.evidence.length, `${c} evidence list`);
    assert.equal(en.meaning, CATEGORIES[c].meaning);
  }
  const en = appealStages("service", false);
  const ko = appealStages("service", false, "ko");
  assert.equal(ko.length, en.length);
  ko.forEach((s, i) => {
    assert.ok(hasHangul(s.name) && hasHangul(s.timing) && hasHangul(s.note));
    assert.equal(s.youMustFile, en[i].youMustFile);
  });
  // The same numbers appear in both languages.
  assert.match(ko[0].timing, /65일.*30일/);
  assert.match(appealStages("part_b_drug", false, "ko")[0].timing, /7일/);
  assert.match(appealStages("service", true, "ko")[1].timing, /72시간/);
  assert.match(ko[2].note, /\$200/);
  assert.match(ko[4].note, /\$1,960/);
  assert.equal(formatLong("2027-01-01", "ko"), "2027년 1월 1일 금요일");
});

test("Korean answers are found for translation; names and addresses are not translated", () => {
  const analysis = { ...classifyByRules(SAMPLE_LETTER), serviceDenied: "고관절 수술 후 입원 재활" };
  const facts = {
    ...EMPTY_FACTS,
    patientName: "김영희",
    doctorName: "Dr. Alan Example",
    mailingAddress: "서울시 12 Sample Lane",
    whyNeeded: "어머니는 혼자 사시고 아직 걷지 못하십니다.",
    whatTried: "Home exercises for one week.",
  };
  assert.deepEqual(Object.keys(koreanFields(analysis, facts)).sort(), ["serviceDenied", "whyNeeded"]);

  const named = dropKoreanNames(analysis, facts);
  assert.equal(named.dropped, true);
  assert.equal(named.facts.patientName, "");
  assert.equal(named.facts.doctorName, "Dr. Alan Example");
  assert.equal(named.facts.mailingAddress, "서울시 12 Sample Lane");
  assert.equal(named.analysis.memberName, "Margaret Sample");

  const done = applyTranslations(named.analysis, named.facts, {
    whyNeeded: "My mother lives alone and cannot walk yet.",
    serviceDenied: "Inpatient rehabilitation after hip surgery",
  });
  const letter = buildLetter({ ...done, today: "2026-11-22" });
  assert.match(letter, /My mother lives alone and cannot walk yet\./);
  assert.match(letter, /Service denied: Inpatient rehabilitation after hip surgery/);
  assert.match(letter, /Enrollee: Margaret Sample/); // falls back to the name on the notice
  assert.match(letter, /서울시 12 Sample Lane/); // address left exactly as typed
  assert.equal(hasHangul(letter.replace("서울시 12 Sample Lane", "")), false);
  assert.equal(dropKoreanNames(analysis, EMPTY_FACTS).dropped, false);
});

test("Korean answers never reach the letter, even when translation fails", () => {
  const analysis = { ...classifyByRules(SAMPLE_LETTER), serviceDenied: "입원 재활" };
  const facts = {
    ...EMPTY_FACTS,
    whyNeeded: "어머니는 혼자 사십니다.",
    whatTried: "집에서 운동을 했습니다.",
    harmIfDelayed: "넘어질 위험이 큽니다.",
    mailingAddress: "12 Sample Lane",
  };
  // Only one of the four Korean fields came back translated.
  const partial = applyTranslations(analysis, facts, { whatTried: "Exercises at home." });
  const safe = blankUntranslated(partial.analysis, partial.facts);
  assert.deepEqual(safe.blanked.sort(), ["harmIfDelayed", "serviceDenied", "whyNeeded"]);

  const letter = buildLetter({ analysis: safe.analysis, facts: safe.facts, today: "2026-11-22" });
  assert.equal(hasHangul(letter), false);
  assert.match(letter, /\[WRITE IN ENGLISH: WHY THIS CARE IS NEEDED\]/);
  assert.match(letter, /Treatments and steps already tried: Exercises at home\./);
  assert.match(letter, /\[WRITE IN ENGLISH: WHAT HAPPENS IF THIS CARE IS DELAYED\]/);
  assert.match(letter, /Service denied: \[THE SERVICE OR ITEM THAT WAS DENIED\]/);

  // Nothing Korean: nothing is touched.
  const english = blankUntranslated(classifyByRules(SAMPLE_LETTER), { ...EMPTY_FACTS, whyNeeded: "She lives alone." });
  assert.deepEqual(english.blanked, []);
  assert.equal(english.facts.whyNeeded, "She lives alone.");
});

test("model failures are sorted into causes the site owner can act on", () => {
  const err = (status: number, message: string) => Object.assign(new Error(message), { status });
  assert.equal(classifyModelError(err(401, "invalid x-api-key")), "auth");
  assert.equal(classifyModelError(err(400, "Your credit balance is too low to access the API")), "billing");
  assert.equal(classifyModelError(err(404, "model: claude-nope")), "model");
  assert.equal(classifyModelError(err(429, "rate limited")), "rate_limit");
  assert.equal(classifyModelError(new Error("socket hang up")), "other");
  assert.equal(classifyModelError(err(400, "anthropic-workspace-id header is required")), "workspace");
  assert.equal(safeDetail("bad key sk-ant-api03-AbC_123-xyz\n  rejected"), "bad key [key removed] rejected");
  assert.equal(safeDetail("x".repeat(500)).length, 300);
});

test("Korean kept beside a translation is removed; real Korean content is not hidden", () => {
  assert.equal(stripKoreanAsides("She would move to a nursing home (요양원) next week."), "She would move to a nursing home next week.");
  assert.equal(stripKoreanAsides("Hip replacement [고관절 치환술] on Oct 20 (left side)."), "Hip replacement on Oct 20 (left side).");
  assert.equal(stripKoreanAsides("She may fall （넘어질 수 있음）."), "She may fall.");
  // Korean outside brackets is a failed translation and must still be detectable.
  assert.equal(hasHangul(stripKoreanAsides("She may 넘어질 수 있습니다.")), true);
});

test("every blank the letter template can produce becomes a question, never a hand edit", () => {
  const empty = { ...classifyByRules("Medicare Advantage notice with nothing recognisable in it at all."), noticeDate: "" };
  const variants = [
    { analysis: empty, facts: EMPTY_FACTS, today: "2026-11-22" },
    { analysis: empty, facts: { ...EMPTY_FACTS, signer: "representative" as const, expedited: true, doctorSupports: true }, today: "2026-11-22" },
    { analysis: { ...empty, noticeDate: "2026-01-05" }, facts: EMPTY_FACTS, today: "2026-11-22" }, // late
  ];
  const seen = new Set<string>();
  for (const v of variants) {
    for (const token of buildLetter(v).match(BLANK_PATTERN) ?? []) {
      seen.add(token);
      assert.ok(resolveBlank(token), `no question for ${token}`);
    }
  }
  assert.ok(seen.size >= 12, `expected the full set of blanks, saw ${seen.size}`);
  for (const t of ["[WRITE IN ENGLISH: WHY THIS CARE IS NEEDED]", "[WRITE IN ENGLISH: WHAT HAPPENS IF THIS CARE IS DELAYED]"]) {
    assert.ok(resolveBlank(t), t);
  }

  // A complete set of answers leaves nothing to ask.
  const full = buildLetter({
    analysis: { ...classifyByRules(SAMPLE_LETTER), appealAddress: "P.O. Box 0000, Anytown, ST 00000" },
    facts: { ...EMPTY_FACTS, mailingAddress: "12 Sample Lane", phone: "555-0100", whyNeeded: "She cannot walk yet." },
    today: "2026-11-22",
  });
  assert.deepEqual(neededFromLetter(full, []), []);
});

test("questions are listed once, in letter order, with the model's wording where it gave one", () => {
  const q = { blank: "[DATE OF SURGERY]", en: "When was the surgery?", ko: "수술은 언제 받으셨나요?" };
  const letter = "From [YOUR PHONE NUMBER]\nSurgery on [DATE OF SURGERY].\nCall [YOUR PHONE NUMBER]. Also [NAME OF THERAPIST].";
  const needed = neededFromLetter(letter, [q]);
  assert.deepEqual(needed.map((n) => n.id), ["facts.phone", "[DATE OF SURGERY]", "[NAME OF THERAPIST]"]);
  assert.deepEqual(needed[1], { kind: "question", id: "[DATE OF SURGERY]", blank: "[DATE OF SURGERY]", question: q });
  assert.equal(needed[2].kind === "question" && needed[2].question, null);

  // The model's questions are matched to real blanks; a blank without one still gets a question.
  const qs = questionsForBlanks(["Surgery was on [DATE OF SURGERY] by [SURGEON]. Phone [YOUR PHONE NUMBER]."], [q, { blank: "[NOT USED]", en: "x", ko: "x" }]);
  assert.deepEqual(qs.map((x) => x.blank), ["[DATE OF SURGERY]", "[SURGEON]"]);
  assert.equal(qs[0].ko, "수술은 언제 받으셨나요?");
  assert.equal(qs[1].en, "Please tell us: surgeon");
});

test("follow-up answers reach the letter even with the standard wording", () => {
  const facts = { ...EMPTY_FACTS, whyNeeded: "She cannot walk yet.", extra: [{ question: "When was the surgery?", answer: "October 20, 2026." }] };
  const analysis = classifyByRules(SAMPLE_LETTER);
  assert.match(buildLetter({ analysis, facts, today: "2026-11-22" }), /\nOctober 20, 2026\.\n/);
  // With tailored arguments the model has already used them, so they are not repeated.
  const tailored = buildLetter({ analysis, facts, today: "2026-11-22", tailoredArguments: ["Para one.", "Para two."] });
  assert.doesNotMatch(tailored, /\nOctober 20, 2026\.\n/);
});

/* ---------- rate limiting and alerts ---------- */

const visitor = (ip: string) => new Request("https://overturned.test/api/draft", { method: "POST", headers: { "x-forwarded-for": `${ip}, 10.0.0.1`, host: "overturned.test" } });
/** A memory store that reports itself as the shared kind, so alert logic runs. */
const sharedStore = (now: () => number): CounterStore => Object.assign(new MemoryStore(now), { kind: "redis" as const });

test("alert rules: checkpoints double, spikes compare with the last six hours, caps fire once each", () => {
  assert.deepEqual([19, 20, 30, 40, 60, 80, 100, 160, 320].filter(isCheckpoint), [20, 40, 80, 160, 320]);
  assert.deepEqual(spikeAlert(20, [0, 0, 0, 0, 0, 0]), { baseline: 0 }); // from nothing to 20 in an hour
  assert.deepEqual(spikeAlert(40, [10, 12, 8, 10, 10, 10]), { baseline: 10 }); // 4x the usual
  assert.equal(spikeAlert(20, [10, 12, 8, 10, 10, 10]), null); // 2x: busy, not accelerating
  assert.equal(spikeAlert(45, [0, 0, 0, 0, 0, 0]), null); // not a checkpoint
  assert.deepEqual([249, 250, 251, 399, 400, 499, 500, 501].map((n) => capAlert(n, 500)), [null, 50, null, null, 80, null, 100, null]);
  assert.equal(dayOverDayAlert(60, 30), true);
  assert.equal(dayOverDayAlert(61, 30), false);
  assert.equal(dayOverDayAlert(20, 10), false); // too small to matter
  assert.equal(dayKey(new Date("2026-11-23T08:05:00Z")), "20261123");
  assert.equal(hourKey(new Date("2026-11-23T08:05:00Z")), "2026112308");
  assert.notEqual(visitorId(visitor("1.1.1.1"), "20261123"), visitorId(visitor("2.2.2.2"), "20261123"));
  assert.notEqual(visitorId(visitor("1.1.1.1"), "20261123"), visitorId(visitor("1.1.1.1"), "20261124"));
  assert.doesNotMatch(visitorId(visitor("1.1.1.1"), "20261123"), /1\.1\.1\.1/);
});

test("one visitor is stopped at the hourly limit, others are not, and the limit lifts the next hour", async () => {
  let t = Date.parse("2026-11-23T08:00:00Z");
  const store = new MemoryStore(() => t);
  const hit = (ip: string) => guard(visitor(ip), "ai", { store, now: new Date(t), notify: async () => {} });
  for (let i = 0; i < 30; i++) assert.deepEqual(await hit("1.1.1.1"), { ok: true, ai: true });
  assert.deepEqual(await hit("1.1.1.1"), { ok: false });
  assert.deepEqual(await hit("2.2.2.2"), { ok: true, ai: true });
  t += 3600_000;
  assert.deepEqual(await hit("1.1.1.1"), { ok: true, ai: true });
});

test("site-wide: alerts fire as usage accelerates and AI switches off at the daily cap", async () => {
  process.env.DAILY_AI_CAP = "60";
  process.env.NTFY_TOPIC = "test-topic";
  try {
    const t = Date.parse("2026-11-23T08:00:00Z");
    const store = sharedStore(() => t);
    const alerts: string[] = [];
    const notify = async (title: string) => void alerts.push(title);
    const results = [];
    // 70 requests in one hour, spread over many visitors so no single one is limited.
    for (let i = 0; i < 70; i++) results.push(await guard(visitor(`9.9.${i}.1`), "ai", { store, now: new Date(t), notify }));

    assert.deepEqual(alerts, [
      "Overturned: alerts are connected", // once, on the first counted request
      "Overturned: usage is accelerating", // 20 this hour, from nothing
      "Overturned: 50% of the daily AI cap used", // 30
      "Overturned: usage is accelerating", // 40: still growing
      "Overturned: 80% of the daily AI cap used", // 48
      "Overturned: daily AI cap reached", // 60
    ]);
    assert.ok(results.slice(0, 60).every((r) => r.ok && r.ai));
    assert.ok(results.slice(60).every((r) => r.ok && !r.ai), "past the cap the site still answers, without AI");
  } finally {
    delete process.env.DAILY_AI_CAP;
    delete process.env.NTFY_TOPIC;
  }
});

test("a blocked visitor does not use up the site's daily cap, and the limiter fails open", async () => {
  const t = Date.parse("2026-11-23T08:00:00Z");
  const store = sharedStore(() => t);
  const alerts: string[] = [];
  const notify = async (title: string) => void alerts.push(title);
  for (let i = 0; i < 45; i++) await guard(visitor("3.3.3.3"), "ai", { store, now: new Date(t), notify });
  assert.deepEqual(await store.get(["ot:h:2026112308", "ot:d:20261123"]), [30, 30]);
  assert.equal(alerts.filter((a) => a === "Overturned: a visitor hit the rate limit").length, 1);

  const broken: CounterStore = { kind: "redis", incr: async () => { throw new Error("down"); }, get: async () => [], once: async () => false, note: async () => {}, readNote: async () => "" };
  assert.deepEqual(await guard(visitor("4.4.4.4"), "ai", { store: broken, now: new Date(t), notify }), { ok: true, ai: true });
});
