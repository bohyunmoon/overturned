# Overturned

Turn a Medicare Advantage denial letter into a plain-language explanation, a first-draft appeal letter and a deadline.
An information and drafting aid. Not legal or medical advice.

## What v1 does

Scope: Medicare Advantage **prior-authorization (pre-service) denials** only.

1. **Capture**: paste the letter, or photograph it (the model reads the photo; no separate OCR service).
2. **Explain**: classifies the denial into one of eight types and explains it in plain language. The user confirms every extracted detail.
3. **Your side**: a short form for the facts, who signs, doctor support, and whether to ask for a fast appeal.
4. **Draft**: a reconsideration letter built from a fixed template plus the user's facts. Missing facts become `[LOUD BLANKS]`.
5. **Send and track**: filing deadline, calendar file with reminders, a checklist, the plan's decision date, and the five appeal levels.

PDF export and the calendar file are generated in the browser.

## Languages

A toggle in the header switches the whole interface between English and Korean. The choice is remembered on the device,
and a browser set to Korean starts in Korean.

- **Always English:** the denial notice the user pastes or photographs, and the appeal letter. The plan writes and reads English.
- **Translated:** every label, instruction, warning, deadline, checklist and appeal-stage description, plus the AI explanation of the letter.
- **Korean answers:** free-text answers written in Korean are translated into English by the model when the draft is written.
- **Names** are never translated or romanized, because they must match the plan's records. A name typed in Korean becomes a blank in the letter.
- **Addresses** are left exactly as typed.

The letter never contains Korean answers. Translation needs the model; if it is unavailable or fails (after one retry),
each untranslated answer becomes a `[WRITE IN ENGLISH: …]` blank and the letter screen says so.

Interface text lives in `src/lib/i18n.tsx` and `src/lib/categories.ko.ts`. The Korean object is typed against the English one,
so a missing string fails the build. The Korean copy has not been reviewed by a native-speaking Medicare counselor; do that before launch.

## Run it

```bash
npm install
cp .env.example .env.local   # add ANTHROPIC_API_KEY
npm run dev
```

`npm test` runs the unit tests, `npm run lint` and `npm run build` should both pass before deploying.

Deploy: import the repo into Vercel and set `ANTHROPIC_API_KEY`. No database or other services.

### Is the AI working?

Open `/api/health` on the deployed site. It makes one tiny model request and reports `ok`, `no_key`, `auth`, `billing`,
`workspace`, `model`, `rate_limit` or `other`, with the HTTP status and the provider's error message. It never shows the key.

If the key is not scoped to a single workspace, also set `ANTHROPIC_WORKSPACE_ID`.

### Offline mode

With no `ANTHROPIC_API_KEY`, the app still works end to end with a keyword reader and template-only letters
(photo reading is disabled). The same path is the fallback when a model call fails.

## How it is put together

| Path | Role |
| --- | --- |
| `src/lib/rules.ts` | Every federal deadline and threshold, with its source and the date it was verified |
| `src/lib/deadlines.ts` | Calendar-exact date maths, filing deadline, appeal stages |
| `src/lib/categories.ts` | The eight denial types: explanation, evidence checklist, argument paragraphs, keyword signals |
| `src/lib/classify.ts` | Offline keyword reader and field extraction |
| `src/lib/llm.ts` | Model calls (structured output via a forced tool), output coercion, citation guard |
| `src/lib/letter.ts` | The letter template |
| `src/lib/i18n.tsx`, `src/lib/categories.ko.ts` | Interface text in English and Korean |
| `src/lib/korean.ts` | Decides what gets translated into English for the letter |
| `src/lib/export.ts` | PDF, calendar file, photo downscaling |
| `src/app/api/*` | `analyze`, `draft` and `translate` routes |
| `src/components/Flow.tsx` | The five-step mobile flow |

## Safety design

- **Deadlines are code, not model output.** The model never computes a date.
- **The model cannot introduce legal authority.** Drafts citing any regulation outside our own reviewed templates are discarded and the template is used.
- **The model is told not to invent facts**, and to leave bracketed blanks instead. The user is told to read every line.
- **Letter text is treated as untrusted input** in both prompts.
- **Nothing is stored server-side.** Progress lives in the browser's localStorage and can be erased. Letter text is sent to the model API for processing; only error messages are logged.
- Every screen that shows a deadline tells the user to confirm it on their own notice.

## Keeping the rules current

`src/lib/rules.ts` was last verified on the date in `RULES_VERIFIED_ON`. Re-check it against the linked CMS and Medicare.gov
pages at least every January: the amount-in-controversy thresholds change yearly, and CMS revises timeframes by regulation
(the filing window moved from 60 to 65 days in 2025).

## Not built yet

- Payments and the free/paid split
- Rate limiting and abuse protection on the three API routes (needed before public launch)
- Multi-page photo capture
- Email or text reminders (v1 uses a calendar file, which needs no backend)
- A privacy policy and terms, and a legal review of the template language and of health-data obligations
- Other denial types: payment denials, Part D, Original Medicare, commercial plans
