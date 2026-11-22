import { parseIso } from "@/lib/deadlines";
import { buildLetter } from "@/lib/letter";
import { coerceAnalysis, draftArgumentsWithModel, hasModel } from "@/lib/llm";
import { EMPTY_FACTS, type UserFacts } from "@/lib/types";

export const maxDuration = 60;

const bad = (message: string, status = 400) => Response.json({ error: message }, { status });
const s = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

function coerceFacts(raw: Record<string, unknown>): UserFacts {
  return {
    ...EMPTY_FACTS,
    signer: raw.signer === "representative" ? "representative" : "patient",
    patientName: s(raw.patientName, 120),
    representativeName: s(raw.representativeName, 120),
    mailingAddress: s(raw.mailingAddress, 300),
    phone: s(raw.phone, 40),
    doctorName: s(raw.doctorName, 120),
    doctorSupports: raw.doctorSupports === true,
    whyNeeded: s(raw.whyNeeded, 3000),
    whatTried: s(raw.whatTried, 2000),
    harmIfDelayed: s(raw.harmIfDelayed, 2000),
    expedited: raw.expedited === true,
    lateReason: s(raw.lateReason, 1000),
  };
}

export async function POST(req: Request) {
  let body: { analysis?: unknown; facts?: unknown; today?: unknown };
  try {
    body = await req.json();
  } catch {
    return bad("Request body must be JSON.");
  }
  if (!body.analysis || typeof body.analysis !== "object" || !body.facts || typeof body.facts !== "object") {
    return bad("Missing denial details.");
  }
  const today = typeof body.today === "string" && parseIso(body.today) !== null ? body.today : new Date().toISOString().slice(0, 10);

  const source = (body.analysis as { source?: unknown }).source === "rules" ? "rules" : "ai";
  const analysis = { ...coerceAnalysis(body.analysis as Record<string, unknown>), source } as ReturnType<typeof coerceAnalysis>;
  const facts = coerceFacts(body.facts as Record<string, unknown>);

  let tailoredArguments: string[] | undefined;
  let tailored = false;
  const hasStory = (facts.whyNeeded + facts.whatTried + facts.harmIfDelayed).trim().length > 30;
  if (hasModel() && hasStory) {
    try {
      tailoredArguments = await draftArgumentsWithModel(analysis, facts);
      tailored = true;
    } catch (err) {
      console.error("draft failed, using template:", err instanceof Error ? err.message : err);
    }
  }

  return Response.json({ letter: buildLetter({ analysis, facts, today, tailoredArguments }), tailored });
}
