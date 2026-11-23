"use client";

import { useEffect, useRef, useState } from "react";
import { categoryText } from "@/lib/categories.ko";
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
import { LOCALE_NAMES, STRINGS, type Strings } from "@/lib/i18n";
import { RULES_VERIFIED_ON, SOURCES } from "@/lib/rules";
import { SAMPLE_LETTER } from "@/lib/sample";
import { DENIAL_CATEGORIES, EMPTY_FACTS, hasHangul, type DenialAnalysis, type Locale, type UserFacts } from "@/lib/types";
import { Button, Card, Field, H2, H3 } from "./ui";

type Step = "capture" | "understand" | "facts" | "letter" | "next";
const STEP_IDS: Step[] = ["capture", "understand", "facts", "letter", "next"];

/** The model-written explanation, cached per language so switching back is instant. */
type Explanation = { summary: string; warnings: string[] };
type Explanations = Partial<Record<Locale, Explanation>>;
type TranslationStatus = "none" | "done" | "failed" | "unavailable";

interface Saved {
  step: Step;
  letterText: string;
  analysis: DenialAnalysis | null;
  explanations: Explanations;
  facts: UserFacts;
  letter: string;
  receivedDate: string;
}

const STORAGE_KEY = "overturned.v1";
const LOCALE_KEY = "overturned.locale";

function loadSaved(): { saved: Saved | null; locale: Locale } {
  let saved: Saved | null = null;
  let locale: Locale = typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("ko") ? "ko" : "en";
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    saved = raw ? (JSON.parse(raw) as Saved) : null;
    const l = window.localStorage.getItem(LOCALE_KEY);
    if (l === "ko" || l === "en") locale = l;
  } catch {
    /* storage unavailable */
  }
  return { saved, locale };
}

/** Throws an Error whose message is an error code from the API. */
async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "generic");
  return data as T;
}

const modelWarnings = (a: DenialAnalysis) => a.warnings.filter((w) => !w.startsWith("code:"));

export default function Flow() {
  const [ready, setReady] = useState(false);
  const [locale, setLocale] = useState<Locale>("en");
  const [today, setToday] = useState("");
  const [step, setStep] = useState<Step>("capture");
  const [letterText, setLetterText] = useState("");
  const [analysis, setAnalysis] = useState<DenialAnalysis | null>(null);
  const [explanations, setExplanations] = useState<Explanations>({});
  const [explaining, setExplaining] = useState<"idle" | "busy" | "failed">("idle");
  const [facts, setFacts] = useState<UserFacts>(EMPTY_FACTS);
  const [letter, setLetter] = useState("");
  const [tailored, setTailored] = useState(false);
  const [translation, setTranslation] = useState<TranslationStatus>("none");
  const [namesDropped, setNamesDropped] = useState(false);
  const [receivedDate, setReceivedDate] = useState("");
  const [busy, setBusy] = useState<keyof Strings["busy"] | "">("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const top = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const s = STRINGS[locale];

  // Restore an in-progress appeal and the language choice saved on this device.
  useEffect(() => {
    const { saved, locale: savedLocale } = loadSaved();
    /* eslint-disable react-hooks/set-state-in-effect -- one-time restore from localStorage after hydration */
    if (saved) {
      setStep(saved.analysis ? saved.step : "capture");
      setLetterText(saved.letterText ?? "");
      setAnalysis(saved.analysis ? { ...saved.analysis, lang: saved.analysis.lang ?? "en" } : null);
      setExplanations(saved.explanations ?? {});
      setFacts({ ...EMPTY_FACTS, ...saved.facts });
      setLetter(saved.letter ?? "");
      setReceivedDate(saved.receivedDate ?? "");
    }
    setLocale(savedLocale);
    setToday(localToday());
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      const data: Saved = { step, letterText, analysis, explanations, facts, letter, receivedDate };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      window.localStorage.setItem(LOCALE_KEY, locale);
    } catch {
      /* private browsing or storage full: carry on without saving */
    }
  }, [ready, step, letterText, analysis, explanations, facts, letter, receivedDate, locale]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const fail = (e: unknown, fallback = "generic") => {
    const code = e instanceof Error ? e.message : fallback;
    setError(code in STRINGS.en.errors ? code : fallback);
  };

  const go = (next: Step) => {
    setError("");
    setStep(next);
    top.current?.scrollIntoView({ block: "start" });
  };

  /** Translate the model's explanation into `target` if we do not have it yet. */
  async function ensureExplanation(target: Locale, a: DenialAnalysis | null, have: Explanations) {
    if (!a || a.source !== "ai" || have[target]) return;
    const from = have[a.lang] ?? { summary: a.plainSummary, warnings: modelWarnings(a) };
    setExplaining("busy");
    try {
      const out = await postJson<Explanation>("/api/translate", { ...from, target });
      setExplanations((x) => ({ ...x, [target]: out }));
      setExplaining("idle");
    } catch {
      setExplaining("failed");
    }
  }

  function changeLocale(next: Locale) {
    if (next === locale) return;
    setLocale(next);
    setExplaining("idle");
    void ensureExplanation(next, analysis, explanations);
  }

  const deadline =
    analysis?.noticeDate && today && parseIso(analysis.noticeDate) !== null ? filingDeadline(analysis.noticeDate, today) : null;

  const patch = (p: Partial<DenialAnalysis>) => setAnalysis((a) => (a ? { ...a, ...p } : a));
  const patchFacts = (p: Partial<UserFacts>) => setFacts((f) => ({ ...f, ...p }));

  async function analyze(payload: { text?: string; image?: { mediaType: string; base64: string } }) {
    setBusy("reading");
    setError("");
    try {
      const { analysis: a } = await postJson<{ analysis: DenialAnalysis }>("/api/analyze", { ...payload, locale });
      setAnalysis(a);
      setExplanations(a.source === "ai" ? { [a.lang]: { summary: a.plainSummary, warnings: modelWarnings(a) } } : {});
      setExplaining("idle");
      setFacts((f) => ({ ...f, patientName: f.patientName || a.memberName, doctorName: f.doctorName || a.providerName }));
      setLetter("");
      go("understand");
    } catch (e) {
      fail(e);
    } finally {
      setBusy("");
    }
  }

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setBusy("photo");
    setError("");
    try {
      const image = await prepareImage(file);
      await analyze({ image });
    } catch {
      setBusy("");
      setError("photo_device");
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function draft() {
    if (!analysis) return;
    setBusy("drafting");
    setError("");
    try {
      const res = await postJson<{ letter: string; tailored: boolean; translation: TranslationStatus; namesDropped: boolean }>(
        "/api/draft",
        { analysis, facts, today },
      );
      setLetter(res.letter);
      setTailored(res.tailored);
      setTranslation(res.translation);
      setNamesDropped(res.namesDropped);
      go("letter");
    } catch (e) {
      fail(e);
    } finally {
      setBusy("");
    }
  }

  function startOver() {
    if (!window.confirm(s.eraseConfirm)) return;
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* nothing to erase */
    }
    setLetterText("");
    setAnalysis(null);
    setExplanations({});
    setFacts(EMPTY_FACTS);
    setLetter("");
    setReceivedDate("");
    go("capture");
  }

  const blanks = letter.match(/\[[A-Z][^\]\n]{2,}\]/g) ?? [];
  const stepIndex = STEP_IDS.indexOf(step);
  const cat = analysis ? categoryText(analysis.category, locale) : null;

  // What to show as the explanation, and whether it is in the reader's language.
  const explanation: Explanation | null = !analysis
    ? null
    : analysis.source === "rules"
      ? { summary: "", warnings: [] }
      : (explanations[locale] ?? explanations[analysis.lang] ?? { summary: analysis.plainSummary, warnings: modelWarnings(analysis) });
  const explanationReady = !analysis || analysis.source === "rules" || Boolean(explanations[locale]) || analysis.lang === locale;
  const ruleWarnings = analysis
    ? analysis.warnings.filter((w) => w.startsWith("code:")).map((w) => s.understand.warn[w.slice(5)]).filter(Boolean)
    : [];
  const warnings = [...ruleWarnings, ...(explanation?.warnings ?? [])];
  const window_ = analysis ? planDecisionWindow(analysis.requestType, facts.expedited, locale) : "";

  return (
    <div lang={locale} className="flex min-h-full flex-1 flex-col">
      <header className="mx-auto w-full max-w-2xl px-4 pb-6 pt-6 sm:px-6 sm:pt-10">
        <div className="flex items-center justify-between gap-3">
          <p className="stamp text-sm sm:text-lg" lang="en">
            Overturned
          </p>
          <div role="group" aria-label={s.toggleLabel} className="no-print flex shrink-0 overflow-hidden whitespace-nowrap rounded-lg border-2 border-pine text-sm font-semibold">
            {(["en", "ko"] as Locale[]).map((l) => (
              <button
                key={l}
                type="button"
                lang={l}
                aria-pressed={locale === l}
                onClick={() => changeLocale(l)}
                className={`min-h-11 px-3 ${locale === l ? "bg-pine text-white" : "bg-card text-pine-dark hover:bg-pine-wash"}`}
              >
                {LOCALE_NAMES[l]}
              </button>
            ))}
          </div>
        </div>
        <h1 className={`mt-5 font-serif font-bold leading-[1.2] ${locale === "ko" ? "text-3xl sm:text-4xl" : "text-4xl sm:text-5xl"}`}>{s.hero.title}</h1>
        <p className="mt-4 text-lg text-muted">{s.hero.sub}</p>
      </header>

      <main className="flex-1">
        <div ref={top} className="mx-auto w-full max-w-2xl scroll-mt-4 px-4 pb-16 sm:px-6">
          <ol className="no-print mb-6 flex gap-1.5" aria-label={s.progress}>
            {s.steps.map((label, i) => (
              <li key={label} className="flex-1" aria-current={i === stepIndex ? "step" : undefined}>
                <div className={`h-1.5 rounded-full ${i <= stepIndex ? "bg-pine" : "bg-rule"}`} />
                <span className={`mt-1 hidden text-xs sm:block ${i === stepIndex ? "font-semibold text-ink" : "text-muted"}`}>
                  {i + 1}. {label}
                </span>
              </li>
            ))}
          </ol>
          <p className="mb-4 text-sm text-muted sm:hidden">{s.stepOf(stepIndex + 1, s.steps.length, s.steps[stepIndex])}</p>

          {error && (
            <div role="alert" className="mb-5 rounded-lg border-2 border-stamp bg-stamp-wash p-4 font-medium">
              {s.errors[error] ?? s.errors.generic}
            </div>
          )}
          <div aria-live="polite" className="sr-only">
            {busy ? s.busy[busy] : ""}
          </div>

          {step === "capture" && (
            <div className="space-y-5">
              <H2>{s.capture.title}</H2>
              <p>{s.capture.intro}</p>
              <Card>
                <Field label={s.capture.pasteLabel} hint={s.capture.pasteHint}>
                  <textarea
                    className="field min-h-52"
                    lang="en"
                    value={letterText}
                    onChange={(e) => setLetterText(e.target.value)}
                    placeholder="Notice of Denial of Medical Coverage…"
                  />
                </Field>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button onClick={() => analyze({ text: letterText })} disabled={!!busy || letterText.trim().length < 40}>
                    {busy ? s.busy[busy] : s.capture.explain}
                  </Button>
                  <Button variant="secondary" onClick={() => fileInput.current?.click()} disabled={!!busy}>
                    {s.capture.usePhoto}
                  </Button>
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="sr-only"
                    tabIndex={-1}
                    aria-label={s.capture.photoAria}
                    onChange={(e) => onPhoto(e.target.files?.[0])}
                  />
                </div>
                <p className="mt-3 text-sm text-muted">{s.capture.multiPage}</p>
              </Card>
              <p>
                {s.capture.sample(
                  <button
                    type="button"
                    className="font-semibold text-pine-dark underline underline-offset-4"
                    onClick={() => setLetterText(SAMPLE_LETTER)}
                  >
                    {s.capture.sampleButton}
                  </button>,
                )}
              </p>
              <Card tone="pine">
                <H3>{s.capture.privacyTitle}</H3>
                <p className="mt-2 text-base">{s.capture.privacyBody}</p>
              </Card>
            </div>
          )}

          {step === "understand" && analysis && cat && explanation && (
            <div className="space-y-5">
              <H2>{s.understand.title}</H2>

              {!analysis.inScope && (
                <Card tone="stamp">
                  <H3>{s.understand.oosTitle}</H3>
                  <p className="mt-2">{s.understand.oosBody}</p>
                </Card>
              )}

              <Card>
                <p className="text-sm font-semibold uppercase tracking-wide text-pine-dark">{cat.label}</p>
                {explanation.summary && (
                  <p className="mt-2 text-lg" lang={explanationReady ? locale : analysis.lang}>
                    {explanation.summary}
                  </p>
                )}
                {!explanationReady && (
                  <p className="mt-2 text-sm text-muted" role="status">
                    {explaining === "busy" ? s.understand.translating : s.understand.notTranslated}
                  </p>
                )}
                {analysis.statedReason && (
                  <blockquote className="mt-4 border-l-4 border-rule pl-4 text-base text-muted">
                    {s.understand.planWords} <span lang="en">&ldquo;{analysis.statedReason}&rdquo;</span>
                  </blockquote>
                )}
                <p className={explanation.summary ? "mt-4 text-base" : "mt-2 text-lg"}>{cat.meaning}</p>
              </Card>

              <Card tone="pine">
                <H3>{s.understand.helpsTitle}</H3>
                <p className="mt-2">{cat.whatHelps}</p>
              </Card>

              {(warnings.length > 0 || analysis.source === "rules") && (
                <Card tone="amber">
                  <H3>{s.understand.checkTitle}</H3>
                  <ul className="mt-2 list-disc space-y-1.5 pl-5">
                    {analysis.source === "rules" && <li>{s.understand.keywordReader}</li>}
                    {warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </Card>
              )}

              <Card>
                <H3>{s.understand.detailsTitle}</H3>
                <p className="mt-1 text-base text-muted">{s.understand.detailsIntro}</p>
                <div className="mt-4 grid gap-4">
                  <Field label={s.understand.noticeDate} hint={s.understand.noticeDateHint}>
                    <input type="date" className="field" value={analysis.noticeDate} max={today} onChange={(e) => patch({ noticeDate: e.target.value })} />
                  </Field>
                  <Field label={s.understand.planName} warning={hasHangul(analysis.planName) ? s.facts.nameInEnglish : undefined}>
                    <input className="field" value={analysis.planName} onChange={(e) => patch({ planName: e.target.value })} />
                  </Field>
                  <Field label={s.understand.whatDenied}>
                    <input className="field" value={analysis.serviceDenied} onChange={(e) => patch({ serviceDenied: e.target.value })} />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label={s.understand.memberId}>
                      <input className="field" value={analysis.memberId} onChange={(e) => patch({ memberId: e.target.value })} />
                    </Field>
                    <Field label={s.understand.refNumber}>
                      <input className="field" value={analysis.referenceNumber} onChange={(e) => patch({ referenceNumber: e.target.value })} />
                    </Field>
                  </div>
                  <Field
                    label={s.understand.whereSend}
                    hint={s.understand.whereSendHint}
                    warning={hasHangul(analysis.appealAddress) ? s.facts.addressInEnglish : undefined}
                  >
                    <textarea className="field min-h-24" value={analysis.appealAddress} onChange={(e) => patch({ appealAddress: e.target.value })} />
                  </Field>
                  <Field label={s.understand.fax}>
                    <input className="field" inputMode="tel" value={analysis.appealFax} onChange={(e) => patch({ appealFax: e.target.value })} />
                  </Field>
                  <Field label={s.understand.kind} hint={s.understand.kindHint}>
                    <select className="field" value={analysis.category} onChange={(e) => patch({ category: e.target.value as DenialAnalysis["category"] })}>
                      {DENIAL_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {categoryText(c, locale).label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={s.understand.requested}>
                    <select className="field" value={analysis.requestType} onChange={(e) => patch({ requestType: e.target.value as DenialAnalysis["requestType"] })}>
                      <option value="service">{s.understand.reqService}</option>
                      <option value="part_b_drug">{s.understand.reqDrug}</option>
                    </select>
                  </Field>
                </div>
              </Card>

              <DeadlineCard deadline={deadline} locale={locale} />

              <div className="flex flex-wrap gap-3">
                <Button onClick={() => go("facts")}>{s.understand.next}</Button>
                <Button variant="quiet" onClick={() => go("capture")}>
                  {s.back}
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
              <H2>{s.facts.title}</H2>
              <p>{s.facts.intro}</p>
              {s.facts.languageNote && (
                <Card tone="pine">
                  <p className="text-base">{s.facts.languageNote}</p>
                </Card>
              )}

              <Card>
                <fieldset>
                  <legend className="font-semibold">{s.facts.whoSigns}</legend>
                  <div className="mt-2 space-y-2">
                    <label className="flex items-start gap-3">
                      <input type="radio" className="mt-1.5 size-5 accent-pine" checked={facts.signer === "patient"} onChange={() => patchFacts({ signer: "patient" })} />
                      <span>{s.facts.signPatient}</span>
                    </label>
                    <label className="flex items-start gap-3">
                      <input type="radio" className="mt-1.5 size-5 accent-pine" checked={facts.signer === "representative"} onChange={() => patchFacts({ signer: "representative" })} />
                      <span>
                        {s.facts.signRep((text) => (
                          <a className="underline" href={SOURCES.aorForm.url} target="_blank" rel="noreferrer">
                            {text}
                          </a>
                        ))}
                      </span>
                    </label>
                  </div>
                </fieldset>
                <div className="mt-4 grid gap-4">
                  <Field
                    label={s.facts.patientName}
                    hint={s.facts.patientNameHint}
                    warning={hasHangul(facts.patientName) ? s.facts.nameInEnglish : undefined}
                  >
                    <input className="field" autoComplete="off" value={facts.patientName} onChange={(e) => patchFacts({ patientName: e.target.value })} />
                  </Field>
                  {facts.signer === "representative" && (
                    <Field label={s.facts.yourName} warning={hasHangul(facts.representativeName) ? s.facts.nameInEnglish : undefined}>
                      <input className="field" autoComplete="name" value={facts.representativeName} onChange={(e) => patchFacts({ representativeName: e.target.value })} />
                    </Field>
                  )}
                  <Field label={s.facts.address} warning={hasHangul(facts.mailingAddress) ? s.facts.addressInEnglish : undefined}>
                    <textarea className="field min-h-20" autoComplete="street-address" value={facts.mailingAddress} onChange={(e) => patchFacts({ mailingAddress: e.target.value })} />
                  </Field>
                  <Field label={s.facts.phone}>
                    <input className="field" type="tel" autoComplete="tel" value={facts.phone} onChange={(e) => patchFacts({ phone: e.target.value })} />
                  </Field>
                </div>
              </Card>

              <Card>
                <div className="grid gap-4">
                  <Field label={s.facts.why} hint={s.facts.whyHint}>
                    <textarea className="field min-h-32" value={facts.whyNeeded} onChange={(e) => patchFacts({ whyNeeded: e.target.value })} />
                  </Field>
                  <Field label={s.facts.tried} hint={s.facts.triedHint}>
                    <textarea className="field min-h-24" value={facts.whatTried} onChange={(e) => patchFacts({ whatTried: e.target.value })} />
                  </Field>
                  <Field label={s.facts.harm} hint={s.facts.harmHint}>
                    <textarea className="field min-h-24" value={facts.harmIfDelayed} onChange={(e) => patchFacts({ harmIfDelayed: e.target.value })} />
                  </Field>
                </div>
              </Card>

              <Card>
                <div className="grid gap-4">
                  <Field label={s.facts.doctor} warning={hasHangul(facts.doctorName) ? s.facts.nameInEnglish : undefined}>
                    <input className="field" value={facts.doctorName} onChange={(e) => patchFacts({ doctorName: e.target.value })} />
                  </Field>
                  <label className="flex items-start gap-3">
                    <input type="checkbox" className="mt-1.5 size-5 accent-pine" checked={facts.doctorSupports} onChange={(e) => patchFacts({ doctorSupports: e.target.checked })} />
                    <span>
                      {s.facts.doctorSupports} <span className="text-muted">{s.facts.doctorSupportsHint}</span>
                    </span>
                  </label>
                  <label className="flex items-start gap-3">
                    <input type="checkbox" className="mt-1.5 size-5 accent-pine" checked={facts.expedited} onChange={(e) => patchFacts({ expedited: e.target.checked })} />
                    <span>
                      <strong>{s.facts.fast}</strong>{" "}
                      <span className="text-muted">{s.facts.fastHint(planDecisionWindow(analysis.requestType, false, locale))}</span>
                    </span>
                  </label>
                  {deadline?.status === "overdue" && (
                    <Field label={s.facts.late} hint={s.facts.lateHint}>
                      <textarea className="field min-h-20" value={facts.lateReason} onChange={(e) => patchFacts({ lateReason: e.target.value })} />
                    </Field>
                  )}
                </div>
              </Card>

              <div className="flex flex-wrap gap-3">
                <Button type="submit" disabled={!!busy}>
                  {busy ? s.busy[busy] : s.facts.submit}
                </Button>
                <Button variant="quiet" onClick={() => go("understand")}>
                  {s.back}
                </Button>
              </div>
            </form>
          )}

          {step === "letter" && analysis && (
            <div className="space-y-5">
              <H2>{s.letter.title}</H2>
              <p>{s.letter.intro}</p>
              {s.letter.englishNote && <p className="text-base text-muted">{s.letter.englishNote}</p>}

              {(translation === "failed" || translation === "unavailable" || hasHangul(letter)) && (
                <Card tone="stamp">
                  <p className="font-medium">
                    {translation === "failed"
                      ? s.letter.translationFailed
                      : translation === "unavailable"
                        ? s.letter.translationUnavailable
                        : s.letter.hangulLeft}
                  </p>
                </Card>
              )}
              {translation === "done" && (
                <Card tone="pine">
                  <p className="text-base">{s.letter.translated}</p>
                </Card>
              )}

              {(blanks.length > 0 || namesDropped) && (
                <Card tone="amber">
                  <H3>{s.letter.blanks(blanks.length)}</H3>
                  {namesDropped && <p className="mt-1 text-base">{s.letter.namesDropped}</p>}
                  <p className="mt-1 text-base">{s.letter.blanksHint}</p>
                  <ul className="mt-2 list-disc pl-5 text-base" lang="en">
                    {[...new Set(blanks)].map((b) => (
                      <li key={b} className="font-mono text-sm">
                        {b}
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              <label className="block">
                <span className="sr-only">{s.letter.textareaLabel}</span>
                <textarea
                  className="field min-h-[32rem] font-serif text-base leading-relaxed"
                  lang="en"
                  value={letter}
                  onChange={(e) => setLetter(e.target.value)}
                  spellCheck
                />
              </label>
              <p className="text-sm text-muted">
                {tailored ? s.letter.tailored : s.letter.standard} {s.letter.rules}
              </p>

              <div className="no-print flex flex-wrap gap-3">
                <Button onClick={() => downloadLetterPdf(letter).catch(() => setError("pdf"))}>{s.letter.pdf}</Button>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(letter);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2500);
                    } catch {
                      setError("copy");
                    }
                  }}
                >
                  {copied ? s.letter.copied : s.letter.copy}
                </Button>
                <Button variant="secondary" onClick={() => go("next")}>
                  {s.letter.next}
                </Button>
              </div>
              <Button variant="quiet" onClick={() => go("facts")}>
                {s.letter.backToAnswers}
              </Button>
            </div>
          )}

          {step === "next" && analysis && cat && (
            <div className="space-y-5">
              <H2>{s.next.title}</H2>

              <DeadlineCard deadline={deadline} locale={locale} />
              {deadline && deadline.status !== "overdue" && (
                <Button
                  variant="secondary"
                  onClick={() =>
                    downloadText(
                      buildDeadlineIcs(deadline.fileBy, {
                        summary: s.next.ics.summary(analysis.planName),
                        description: s.next.ics.description(analysis.serviceDenied, formatLong(deadline.fileBy, locale)),
                        alarm: s.next.ics.alarm,
                      }),
                      "appeal-deadline.ics",
                      "text/calendar",
                    )
                  }
                >
                  {s.next.calendar}
                </Button>
              )}

              <Card>
                <H3>{s.next.beforeTitle}</H3>
                <ul className="mt-3 space-y-2.5">
                  {[
                    ...s.next.checklistStart,
                    ...cat.evidence.map((e) => s.next.gather(e)),
                    ...(facts.signer === "representative" ? [s.next.checklistRep] : []),
                    ...s.next.checklistEnd,
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <input type="checkbox" className="mt-1.5 size-5 shrink-0 accent-pine" aria-label={item} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </Card>

              <Card>
                <H3>{s.next.whenTitle}</H3>
                <p className="mt-2">{s.next.whenBody(window_, facts.expedited)}</p>
                <div className="mt-4">
                  <Field label={s.next.received} hint={s.next.receivedHint}>
                    <input type="date" className="field" value={receivedDate} max={today} onChange={(e) => setReceivedDate(e.target.value)} />
                  </Field>
                </div>
                {receivedDate && parseIso(receivedDate) !== null && (
                  <p className="mt-3 rounded-lg bg-pine-wash p-3">
                    {s.next.expectBy(formatLong(planDecisionDue(receivedDate, analysis.requestType, facts.expedited), locale))}
                  </p>
                )}
              </Card>

              <Card>
                <H3>{s.next.againTitle}</H3>
                <p className="mt-2 text-base text-muted">{s.next.againIntro}</p>
                <ol className="mt-4 space-y-4">
                  {appealStages(analysis.requestType, facts.expedited, locale).map((st) => (
                    <li key={st.level} className="flex gap-3">
                      <span className={`flex size-8 shrink-0 items-center justify-center rounded-full font-bold ${st.level === 1 ? "bg-pine text-white" : "border-2 border-rule text-muted"}`}>
                        {st.level}
                      </span>
                      <div>
                        <p className="font-semibold">
                          {st.name} <span className="font-normal text-muted">· {st.who}</span>
                        </p>
                        <p className="text-base">{st.timing}</p>
                        <p className="text-base text-muted">{st.note}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </Card>

              <Card tone="pine">
                <H3>{s.next.helpTitle}</H3>
                <ul className="mt-2 space-y-2">
                  {s.next.interpreter && (
                    <li>
                      {s.next.interpreter}{" "}
                      <a className="underline" href={SOURCES.otherLanguages.url} target="_blank" rel="noreferrer" lang="en">
                        Medicare.gov
                      </a>
                    </li>
                  )}
                  <li>
                    <a className="font-semibold underline" href={SOURCES.ship.url} target="_blank" rel="noreferrer">
                      {s.next.ship}
                    </a>
                    {s.next.shipNote}
                  </li>
                  <li>{s.next.phone}</li>
                  <li>
                    <a className="font-semibold underline" href={SOURCES.medicareGovAppeals.url} target="_blank" rel="noreferrer">
                      {s.next.medicareLink}
                    </a>
                  </li>
                </ul>
              </Card>

              <div className="no-print flex flex-wrap gap-3">
                <Button variant="secondary" onClick={() => go("letter")}>
                  {s.next.backToLetter}
                </Button>
                <Button variant="quiet" onClick={startOver}>
                  {s.next.startOver}
                </Button>
              </div>
            </div>
          )}

          {step !== "capture" && step !== "next" && (
            <p className="no-print mt-8 text-sm">
              <button type="button" className="text-muted underline underline-offset-4" onClick={startOver}>
                {s.eraseSmall}
              </button>
            </p>
          )}
        </div>
      </main>

      <footer className="border-t border-rule bg-card">
        <div className="mx-auto max-w-2xl space-y-3 px-4 py-8 text-sm text-muted sm:px-6">
          <p>{s.footer.disclaimer}</p>
          <p>
            {s.footer.sources(RULES_VERIFIED_ON)}{" "}
            {[SOURCES.medicareGovAppeals, SOURCES.cmsReconsideration, SOURCES.cmsIre, SOURCES.cmsFlowchart].map((src, i) => (
              <span key={src.url} lang="en">
                {i > 0 && "; "}
                <a className="underline" href={src.url} target="_blank" rel="noreferrer">
                  {src.label}
                </a>
              </span>
            ))}
            .
          </p>
        </div>
      </footer>
    </div>
  );
}

function DeadlineCard({ deadline, locale }: { deadline: ReturnType<typeof filingDeadline> | null; locale: Locale }) {
  const s = STRINGS[locale].deadline;
  if (!deadline) {
    return (
      <Card tone="amber">
        <H3>{s.title}</H3>
        <p className="mt-2">{s.enterDate}</p>
      </Card>
    );
  }
  const overdue = deadline.status === "overdue";
  const tone = overdue || deadline.status === "urgent" ? "stamp" : deadline.status === "soon" ? "amber" : "pine";
  const date = formatLong(deadline.fileBy, locale);
  return (
    <Card tone={tone}>
      <H3>{s.title}</H3>
      {overdue ? (
        <p className="mt-2">{s.overdue(date)}</p>
      ) : (
        <>
          <p className="mt-2 text-lg">{s.mustReceive(date)}</p>
          <p className="mt-1 font-serif text-3xl font-bold">{s.daysLeft(deadline.daysLeft)}</p>
          <p className="mt-2 text-base">{s.dontWait(deadline.fallsOnWeekend)}</p>
        </>
      )}
      <p className="mt-3 text-base">{s.confirm}</p>
    </Card>
  );
}
