import Flow from "@/components/Flow";
import { RULES_VERIFIED_ON, SOURCES } from "@/lib/rules";

export default function Home() {
  return (
    <>
      <header className="mx-auto w-full max-w-2xl px-4 pb-6 pt-8 sm:px-6 sm:pt-12">
        <p className="stamp text-lg">Overturned</p>
        <h1 className="mt-5 font-serif text-4xl font-bold leading-[1.1] sm:text-5xl">
          Denied by a Medicare Advantage plan? You can appeal.
        </h1>
        <p className="mt-4 text-lg text-muted">
          Most people never do. Turn the denial letter into a plain-language explanation, a first-draft appeal and a deadline,
          in a few minutes.
        </p>
      </header>

      <main className="flex-1">
        <Flow />
      </main>

      <footer className="border-t border-rule bg-card">
        <div className="mx-auto max-w-2xl space-y-3 px-4 py-8 text-sm text-muted sm:px-6">
          <p>
            <strong className="text-ink">Overturned is not legal or medical advice.</strong> It is an information and drafting
            aid. It is not affiliated with Medicare, the U.S. government or any health plan. Always confirm deadlines and
            instructions on your own denial notice.
          </p>
          <p>
            Appeal rules checked against official sources on {RULES_VERIFIED_ON}:{" "}
            {[SOURCES.medicareGovAppeals, SOURCES.cmsReconsideration, SOURCES.cmsIre, SOURCES.cmsFlowchart].map((s, i) => (
              <span key={s.url}>
                {i > 0 && "; "}
                <a className="underline" href={s.url} target="_blank" rel="noreferrer">
                  {s.label}
                </a>
              </span>
            ))}
            .
          </p>
        </div>
      </footer>
    </>
  );
}
