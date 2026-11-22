"use client";

import { useEffect, useRef, useState } from "react";
import { CATEGORIES } from "@/lib/categories";
import {
  appealStages,
  filingDeadline,
  formatLong,
  localToday,
  parseIso,
  planDecisionDue,
  planDecisionWindow,
} from "@/lib/deadlines";
import { buildDeadlineIcs, downloadLetterPdf, downloadText, prepareImage } from "@/lib/export";
import { RULES, SOURCES } from "@/lib/rules";
import { SAMPLE_LETTER } from "@/lib/sample";
import { DENIAL_CATEGORIES, EMPTY_FACTS, type DenialAnalysis, type UserFacts } from "@/lib/types";
import { Button, Card, Field, H2, H3 } from "./ui";

type Step = "capture" | "understand" | "facts" | "letter" | "next";
const STEPS: { id: Step; label: string }[] = [
  { id: "capture", label: "Your letter" },
  { id: "understand", label: "What it means" },
  { id: "facts", label: "Your side" },
  { id: "letter", label: "Appeal draft" },
  { id: "next", label: "Send and track" },
];

interface Saved {
  step: Step;
  letterText: string;
  analysis: DenialAnalysis | null;
  facts: UserFacts;
  letter: string;
  receivedDate: string;
}

const STORAGE_KEY = "overturned.v1";

function loadSaved(): Saved | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
  return data as T;
}

export default function Flow() {
  const [ready, setReady] = useState(false);
  const [today, setToday] = useState("");
  const [step, setStep] = useState<Step>("capture");
  const [letterText, setLetterText] = useState("");
  const [analysis, setAnalysis] = useState<DenialAnalysis | null>(null);
  const [facts, setFacts] = useState<UserFacts>(EMPTY_FACTS);
  const [letter, setLetter] = useState("");
  const [tailored, setTailored] = useState(false);
  const [receivedDate, setReceivedDate] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const top = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Restore an in-progress appeal saved on this device.
  useEffect(() => {
    const saved = loadSaved();
    /* eslint-disable react-hooks/set-state-in-effect -- one-time restore from localStorage after hydration */
    if (saved) {
      setStep(saved.analysis ? saved.step : "capture");
      setLetterText(saved.letterText ?? "");
      setAnalysis(saved.analysis ?? null);
      setFacts({ ...EMPTY_FACTS, ...saved.facts });
      setLetter(saved.letter ?? "");
      setReceivedDate(saved.receivedDate ?? "");
    }
    setToday(localToday());
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      const data: Saved = { step, letterText, analysis, facts, letter, receivedDate };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* private browsing or storage full: carry on without saving */
    }
  }, [ready, step, letterText, analysis, facts, letter, receivedDate]);

  const go = (s: Step) => {
    setError("");
    setStep(s);
    top.current?.scrollIntoView({ block: "start" });
  };

  const deadline =
    analysis?.noticeDate && today && parseIso(analysis.noticeDate) !== null ? filingDeadline(analysis.noticeDate, today) : null;

  const patch = (p: Partial<DenialAnalysis>) => setAnalysis((a) => (a ? { ...a, ...p } : a));
  const patchFacts = (p: Partial<UserFacts>) => setFacts((f) => ({ ...f, ...p }));

  async function analyze(payload: { text?: string; image?: { mediaType: string; base64: string } }) {
    setBusy("Reading the letter…");
    setError("");
    try {
      const { analysis: a } = await postJson<{ analysis: DenialAnalysis }>("/api/analyze", payload);
      setAnalysis(a);
      setFacts((f) => ({ ...f, patientName: f.patientName || a.memberName, doctorName: f.doctorName || a.providerName }));
      setLetter("");
      go("understand");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy("");
    }
  }

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setBusy("Preparing the photo…");
    setError("");
    try {
      const image = await prepareImage(file);
      await analyze({ image });
    } catch (e) {
      setBusy("");
      setError(e instanceof Error ? e.message : "We could not use that photo.");
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function draft() {
    if (!analysis) return;
    setBusy("Writing your draft…");
    setError("");
    try {
      const res = await postJson<{ letter: string; tailored: boolean }>("/api/draft", { analysis, facts, today });
      setLetter(res.letter);
      setTailored(res.tailored);
      go("letter");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy("");
    }
  }

  function startOver() {
    if (!window.confirm("Erase this appeal from this device and start over?")) return;
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* nothing to erase */
    }
    setLetterText("");
    setAnalysis(null);
    setFacts(EMPTY_FACTS);
    setLetter("");
    setReceivedDate("");
    go("capture");
  }

  const blanks = letter.match(/\[[A-Z][^\]\n]{2,}\]/g) ?? [];
  const stepIndex = STEPS.findIndex((s) => s.id === step);
  const cat = analysis ? CATEGORIES[analysis.category] : null;

  return (
    <div ref={top} className="mx-auto w-full max-w-2xl scroll-mt-4 px-4 pb-16 sm:px-6">
      <ol className="no-print mb-6 flex gap-1.5" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s.id} className="flex-1" aria-current={i === stepIndex ? "step" : undefined}>
            <div className={`h-1.5 rounded-full ${i <= stepIndex ? "bg-pine" : "bg-rule"}`} />
            <span className={`mt-1 hidden text-xs sm:block ${i === stepIndex ? "font-semibold text-ink" : "text-muted"}`}>
              {i + 1}. {s.label}
            </span>
          </li>
        ))}
      </ol>
      <p className="mb-4 text-sm text-muted sm:hidden">
        Step {stepIndex + 1} of {STEPS.length}: {STEPS[stepIndex].label}
      </p>

      {error && (
        <div role="alert" className="mb-5 rounded-lg border-2 border-stamp bg-stamp-wash p-4 font-medium">
          {error}
        </div>
      )}
      <div aria-live="polite" className="sr-only">
        {busy}
      </div>

      {step === "capture" && (
        <div className="space-y-5">
          <H2>Start with the denial letter</H2>
          <p>
            Type or paste the letter from the Medicare Advantage plan, or take a photo of it. We will explain what it says and
            help you draft an appeal.
          </p>
          <Card>
            <Field label="Paste the letter's text" hint="Include the whole notice if you can, especially the date and the reason.">
              <textarea
                className="field min-h-52"
                value={letterText}
                onChange={(e) => setLetterText(e.target.value)}
                placeholder="Notice of Denial of Medical Coverage…"
              />
            </Field>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button onClick={() => analyze({ text: letterText })} disabled={!!busy || letterText.trim().length < 40}>
                {busy || "Explain this letter"}
              </Button>
              <Button variant="secondary" onClick={() => fileInput.current?.click()} disabled={!!busy}>
                Use a photo instead
              </Button>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                tabIndex={-1}
                aria-label="Photo of the denial letter"
                onChange={(e) => onPhoto(e.target.files?.[0])}
              />
            </div>
            <p className="mt-3 text-sm text-muted">
              For a multi-page letter, photograph the page that gives the reason and the date, or paste the text.
            </p>
          </Card>
          <p>
            No letter handy?{" "}
            <button
              type="button"
              className="font-semibold text-pine-dark underline underline-offset-4"
              onClick={() => setLetterText(SAMPLE_LETTER)}
            >
              Load a made-up sample letter
            </button>{" "}
            to see how it works.
          </p>
          <Card tone="pine">
            <H3>Your privacy</H3>
            <p className="mt-2 text-base">
              We do not create an account or keep your letter on our servers. Your progress is saved only in this browser on this
              device, and you can erase it at any time. To read and draft, the letter&apos;s text is sent to an AI service for
              processing.
            </p>
          </Card>
        </div>
      )}

      {step === "understand" && analysis && cat && (
        <div className="space-y-5">
          <H2>What this letter means</H2>

          {!analysis.inScope && (
            <Card tone="stamp">
              <H3>This may not be the kind of denial we cover yet</H3>
              <p className="mt-2">
                Overturned currently handles one situation: a Medicare Advantage plan refusing to approve care{" "}
                <em>before</em> you get it. The deadlines below may not apply to your letter. You can keep going, but check
                everything against your notice or call 1-800-MEDICARE.
              </p>
            </Card>
          )}

          <Card>
            <p className="text-sm font-semibold uppercase tracking-wide text-pine-dark">{cat.label}</p>
            <p className="mt-2 text-lg">{analysis.plainSummary}</p>
            {analysis.statedReason && (
              <blockquote className="mt-4 border-l-4 border-rule pl-4 text-base text-muted">
                The plan&apos;s words: &ldquo;{analysis.statedReason}&rdquo;
              </blockquote>
            )}
            {analysis.plainSummary !== cat.meaning && <p className="mt-4 text-base">{cat.meaning}</p>}
          </Card>

          <Card tone="pine">
            <H3>What usually helps with this kind of denial</H3>
            <p className="mt-2">{cat.whatHelps}</p>
          </Card>

          {(analysis.warnings.length > 0 || analysis.source === "rules") && (
            <Card tone="amber">
              <H3>Please double check</H3>
              <ul className="mt-2 list-disc space-y-1.5 pl-5">
                {analysis.source === "rules" && (
                  <li>
                    This letter was read by a basic keyword reader, not the full AI reader, so details below may be missing or
                    wrong. Check each one against your letter.
                  </li>
                )}
                {analysis.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <H3>Check these details against your letter</H3>
            <p className="mt-1 text-base text-muted">We pulled these from the letter. Fix anything that is wrong or blank.</p>
            <div className="mt-4 grid gap-4">
              <Field label="Date on the notice" hint="The date printed on the letter itself. Your deadline is counted from it.">
                <input type="date" className="field" value={analysis.noticeDate} max={today} onChange={(e) => patch({ noticeDate: e.target.value })} />
              </Field>
              <Field label="Plan name">
                <input className="field" value={analysis.planName} onChange={(e) => patch({ planName: e.target.value })} />
              </Field>
              <Field label="What was denied">
                <input className="field" value={analysis.serviceDenied} onChange={(e) => patch({ serviceDenied: e.target.value })} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Member ID">
                  <input className="field" value={analysis.memberId} onChange={(e) => patch({ memberId: e.target.value })} />
                </Field>
                <Field label="Reference number" hint="">
                  <input className="field" value={analysis.referenceNumber} onChange={(e) => patch({ referenceNumber: e.target.value })} />
                </Field>
              </div>
              <Field label="Where to send the appeal" hint="The appeals mailing address printed on the notice.">
                <textarea className="field min-h-24" value={analysis.appealAddress} onChange={(e) => patch({ appealAddress: e.target.value })} />
              </Field>
              <Field label="Appeals fax number, if listed">
                <input className="field" inputMode="tel" value={analysis.appealFax} onChange={(e) => patch({ appealFax: e.target.value })} />
              </Field>
              <Field label="Kind of denial" hint="Change this if we got it wrong. It shapes the draft.">
                <select className="field" value={analysis.category} onChange={(e) => patch({ category: e.target.value as DenialAnalysis["category"] })}>
                  {DENIAL_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORIES[c].label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="What was requested">
                <select className="field" value={analysis.requestType} onChange={(e) => patch({ requestType: e.target.value as DenialAnalysis["requestType"] })}>
                  <option value="service">A medical service, stay, test or equipment</option>
                  <option value="part_b_drug">A drug given in a doctor&apos;s office or clinic (Part B drug)</option>
                </select>
              </Field>
            </div>
          </Card>

          <DeadlineCard deadline={deadline} />

          <div className="flex flex-wrap gap-3">
            <Button onClick={() => go("facts")}>Continue to my side of the story</Button>
            <Button variant="quiet" onClick={() => go("capture")}>
              Back
            </Button>
          </div>
        </div>
      )}

      {step === "facts" && analysis && (
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            draft();
          }}
        >
          <H2>Your side of the story</H2>
          <p>
            Plain words are fine. Write it in the voice of the person who will sign: &ldquo;I&rdquo; if the patient signs, &ldquo;my mother&rdquo; or
            &ldquo;my father&rdquo; if you sign for them. Write what you know to be true. Leave anything you are unsure of blank; the draft will mark it
            for you to fill in.
          </p>

          <Card>
            <fieldset>
              <legend className="font-semibold">Who will sign the letter?</legend>
              <div className="mt-2 space-y-2">
                <label className="flex items-start gap-3">
                  <input type="radio" className="mt-1.5 size-5 accent-pine" checked={facts.signer === "patient"} onChange={() => patchFacts({ signer: "patient" })} />
                  <span>
                    <strong>The patient.</strong> Simplest. If you are helping a parent, write it together and have them sign.
                  </span>
                </label>
                <label className="flex items-start gap-3">
                  <input type="radio" className="mt-1.5 size-5 accent-pine" checked={facts.signer === "representative"} onChange={() => patchFacts({ signer: "representative" })} />
                  <span>
                    <strong>Me, on the patient&apos;s behalf.</strong> The plan will need a signed{" "}
                    <a className="underline" href={SOURCES.aorForm.url} target="_blank" rel="noreferrer">
                      Appointment of Representative form
                    </a>{" "}
                    or legal papers such as a health care power of attorney.
                  </span>
                </label>
              </div>
            </fieldset>
            <div className="mt-4 grid gap-4">
              <Field label="Patient's full name" hint="As it appears on the plan card.">
                <input className="field" autoComplete="off" value={facts.patientName} onChange={(e) => patchFacts({ patientName: e.target.value })} />
              </Field>
              {facts.signer === "representative" && (
                <Field label="Your full name">
                  <input className="field" autoComplete="name" value={facts.representativeName} onChange={(e) => patchFacts({ representativeName: e.target.value })} />
                </Field>
              )}
              <Field label="Mailing address for the reply">
                <textarea className="field min-h-20" autoComplete="street-address" value={facts.mailingAddress} onChange={(e) => patchFacts({ mailingAddress: e.target.value })} />
              </Field>
              <Field label="Phone number">
                <input className="field" type="tel" autoComplete="tel" value={facts.phone} onChange={(e) => patchFacts({ phone: e.target.value })} />
              </Field>
            </div>
          </Card>

          <Card>
            <div className="grid gap-4">
              <Field label="Why is this care needed?" hint="What happened, what the doctor recommended, and why.">
                <textarea className="field min-h-32" value={facts.whyNeeded} onChange={(e) => patchFacts({ whyNeeded: e.target.value })} />
              </Field>
              <Field label="What has already been tried?" hint="Other treatments, therapy, medicines, and how they went. Skip if none.">
                <textarea className="field min-h-24" value={facts.whatTried} onChange={(e) => patchFacts({ whatTried: e.target.value })} />
              </Field>
              <Field label="What happens if this care is delayed or refused?" hint="Safety at home, pain, falls, losing ground, and so on.">
                <textarea className="field min-h-24" value={facts.harmIfDelayed} onChange={(e) => patchFacts({ harmIfDelayed: e.target.value })} />
              </Field>
            </div>
          </Card>

          <Card>
            <div className="grid gap-4">
              <Field label="Treating doctor's name">
                <input className="field" value={facts.doctorName} onChange={(e) => patchFacts({ doctorName: e.target.value })} />
              </Field>
              <label className="flex items-start gap-3">
                <input type="checkbox" className="mt-1.5 size-5 accent-pine" checked={facts.doctorSupports} onChange={(e) => patchFacts({ doctorSupports: e.target.checked })} />
                <span>
                  The doctor will write a letter supporting this appeal.{" "}
                  <span className="text-muted">Worth asking for. It is often the strongest thing you can include.</span>
                </span>
              </label>
              <label className="flex items-start gap-3">
                <input type="checkbox" className="mt-1.5 size-5 accent-pine" checked={facts.expedited} onChange={(e) => patchFacts({ expedited: e.target.checked })} />
                <span>
                  <strong>Ask for a fast appeal ({RULES.planDecision.expeditedHours} hours).</strong>{" "}
                  <span className="text-muted">
                    For when waiting {planDecisionWindow(analysis.requestType, false)} could seriously harm the patient&apos;s
                    health or ability to recover. If the doctor asks for a fast appeal, the plan has to grant it, so the quickest
                    route is often to have the doctor&apos;s office call the plan.
                  </span>
                </span>
              </label>
              {deadline?.status === "overdue" && (
                <Field
                  label="Why couldn't the appeal be sent in time?"
                  hint={`The ${RULES.daysToFileReconsideration}-day window appears to have passed. Plans can accept a late appeal for a good reason, such as serious illness or never receiving the notice.`}
                >
                  <textarea className="field min-h-20" value={facts.lateReason} onChange={(e) => patchFacts({ lateReason: e.target.value })} />
                </Field>
              )}
            </div>
          </Card>

          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={!!busy}>
              {busy || "Write my draft"}
            </Button>
            <Button variant="quiet" onClick={() => go("understand")}>
              Back
            </Button>
          </div>
        </form>
      )}

      {step === "letter" && analysis && (
        <div className="space-y-5">
          <H2>Your appeal draft</H2>
          <p>
            This is a first draft for you to finish. Read every line and change anything that is not accurate. You are the one
            signing it.
          </p>

          {blanks.length > 0 && (
            <Card tone="amber">
              <H3>
                {blanks.length} {blanks.length === 1 ? "blank" : "blanks"} to fill in
              </H3>
              <p className="mt-1 text-base">Look for the words in [CAPITALS AND BRACKETS] and replace each one:</p>
              <ul className="mt-2 list-disc pl-5 text-base">
                {[...new Set(blanks)].map((b) => (
                  <li key={b} className="font-mono text-sm">
                    {b}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <label className="block">
            <span className="sr-only">Appeal letter text</span>
            <textarea
              className="field min-h-[32rem] font-serif text-base leading-relaxed"
              value={letter}
              onChange={(e) => setLetter(e.target.value)}
              spellCheck
            />
          </label>
          <p className="text-sm text-muted">
            {tailored
              ? "The argument paragraphs were drafted by AI from what you wrote. It can make mistakes. Check that every fact is true."
              : "This draft uses our standard wording for this kind of denial."}{" "}
            The rules it cites are federal Medicare regulations; your doctor&apos;s office or a free Medicare counselor can help you
            check they fit your case.
          </p>

          <div className="no-print flex flex-wrap gap-3">
            <Button onClick={() => downloadLetterPdf(letter).catch(() => setError("We could not make the PDF. Copy the text instead."))}>
              Download PDF to print
            </Button>
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(letter);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2500);
                } catch {
                  setError("Copying is blocked in this browser. Select the text and copy it by hand.");
                }
              }}
            >
              {copied ? "Copied" : "Copy text"}
            </Button>
            <Button variant="secondary" onClick={() => go("next")}>
              Next: send and track
            </Button>
          </div>
          <Button variant="quiet" onClick={() => go("facts")}>
            Back to change my answers
          </Button>
        </div>
      )}

      {step === "next" && analysis && cat && (
        <div className="space-y-5">
          <H2>Send it and keep track</H2>

          <DeadlineCard deadline={deadline} />
          {deadline && deadline.status !== "overdue" && (
            <Button
              variant="secondary"
              onClick={() =>
                downloadText(buildDeadlineIcs(deadline.fileBy, analysis.planName, analysis.serviceDenied), "appeal-deadline.ics", "text/calendar")
              }
            >
              Add the deadline to my calendar
            </Button>
          )}

          <Card>
            <H3>Before you send</H3>
            <ul className="mt-3 space-y-2.5">
              {[
                "Fill in every blank, print the letter and sign it.",
                "Attach a copy of the denial notice.",
                ...cat.evidence.map((e) => `Gather if you can: ${e.charAt(0).toLowerCase()}${e.slice(1)}.`),
                ...(facts.signer === "representative" ? ["Attach the signed Appointment of Representative form or power of attorney."] : []),
                "Keep a copy of everything you send.",
                "Send it in a way that gives you proof: certified mail with return receipt, or fax with a confirmation page.",
                "Call the plan a few days later to confirm they received it. Write down the date and who you spoke with.",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <input type="checkbox" className="mt-1.5 size-5 shrink-0 accent-pine" aria-label={item} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <H3>When will the plan answer?</H3>
            <p className="mt-2">
              Once the plan receives your appeal, it has <strong>{planDecisionWindow(analysis.requestType, facts.expedited)}</strong>{" "}
              to decide{facts.expedited ? ", if it agrees the appeal should be fast" : ""}.
            </p>
            <div className="mt-4">
              <Field label="Date the plan received your appeal" hint="Fill this in once you have delivery confirmation.">
                <input type="date" className="field" value={receivedDate} max={today} onChange={(e) => setReceivedDate(e.target.value)} />
              </Field>
            </div>
            {receivedDate && parseIso(receivedDate) !== null && (
              <p className="mt-3 rounded-lg bg-pine-wash p-3">
                Expect a written decision by{" "}
                <strong>{formatLong(planDecisionDue(receivedDate, analysis.requestType, facts.expedited))}</strong>. If you hear
                nothing by then, call the plan and 1-800-MEDICARE.
              </p>
            )}
          </Card>

          <Card>
            <H3>If the plan says no again</H3>
            <p className="mt-2 text-base text-muted">This appeal is the first of five possible levels. Most people never need the later ones.</p>
            <ol className="mt-4 space-y-4">
              {appealStages(analysis.requestType, facts.expedited).map((s) => (
                <li key={s.level} className="flex gap-3">
                  <span className={`flex size-8 shrink-0 items-center justify-center rounded-full font-bold ${s.level === 1 ? "bg-pine text-white" : "border-2 border-rule text-muted"}`}>
                    {s.level}
                  </span>
                  <div>
                    <p className="font-semibold">
                      {s.name} <span className="font-normal text-muted">· {s.who}</span>
                    </p>
                    <p className="text-base">{s.timing}</p>
                    <p className="text-base text-muted">{s.note}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>

          <Card tone="pine">
            <H3>Free help from real people</H3>
            <ul className="mt-2 space-y-2">
              <li>
                <a className="font-semibold underline" href={SOURCES.ship.url} target="_blank" rel="noreferrer">
                  State Health Insurance Assistance Program (SHIP)
                </a>
                : free, unbiased Medicare counselors in every state.
              </li>
              <li>
                <strong>1-800-MEDICARE</strong> (1-800-633-4227), any time.
              </li>
              <li>
                <a className="font-semibold underline" href={SOURCES.medicareGovAppeals.url} target="_blank" rel="noreferrer">
                  Medicare.gov: appeals in Medicare health plans
                </a>
              </li>
            </ul>
          </Card>

          <div className="no-print flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => go("letter")}>
              Back to my letter
            </Button>
            <Button variant="quiet" onClick={startOver}>
              Erase and start over
            </Button>
          </div>
        </div>
      )}

      {step !== "capture" && step !== "next" && (
        <p className="no-print mt-8 text-sm">
          <button type="button" className="text-muted underline underline-offset-4" onClick={startOver}>
            Erase this appeal from this device
          </button>
        </p>
      )}
    </div>
  );
}

function DeadlineCard({ deadline }: { deadline: ReturnType<typeof filingDeadline> | null }) {
  if (!deadline) {
    return (
      <Card tone="amber">
        <H3>Your deadline</H3>
        <p className="mt-2">
          Enter the date printed on the notice to see your deadline. You generally have {RULES.daysToFileReconsideration} days from
          that date.
        </p>
      </Card>
    );
  }
  const overdue = deadline.status === "overdue";
  const tone = overdue || deadline.status === "urgent" ? "stamp" : deadline.status === "soon" ? "amber" : "pine";
  return (
    <Card tone={tone}>
      <H3>Your deadline</H3>
      {overdue ? (
        <p className="mt-2">
          The {RULES.daysToFileReconsideration}-day window appears to have ended on <strong>{formatLong(deadline.fileBy)}</strong>.
          You can still ask the plan to accept a late appeal if there was a good reason for the delay. Send it as soon as you can.
        </p>
      ) : (
        <>
          <p className="mt-2 text-lg">
            The plan must <em>receive</em> the appeal by <strong>{formatLong(deadline.fileBy)}</strong>.
          </p>
          <p className="mt-1 font-serif text-3xl font-bold">
            {deadline.daysLeft === 0 ? "That is today" : `${deadline.daysLeft} ${deadline.daysLeft === 1 ? "day" : "days"} left`}
          </p>
          <p className="mt-2 text-base">
            Do not wait for the last day. Mail can take a week
            {deadline.fallsOnWeekend ? ", and this date falls on a weekend" : ""}. Aim to send it at least 10 days early.
          </p>
        </>
      )}
      <p className="mt-3 text-base">
        <strong>Confirm this date on your own notice.</strong> We count {RULES.daysToFileReconsideration} calendar days from the date
        on the notice, which is the general Medicare rule. Your notice is the final word.
      </p>
    </Card>
  );
}
