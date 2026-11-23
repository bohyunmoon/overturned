import { connection } from "next/server";
import { checkModel } from "@/lib/llm";

export const maxDuration = 30;

/**
 * Owner diagnostic: is the AI reader working on this deployment, and if not,
 * why. Reports a category only, never the key or the provider's message.
 *
 *   ok          key, billing and model name all work
 *   no_key      ANTHROPIC_API_KEY is not set for this deployment
 *   auth        the key was rejected
 *   billing     the account has no credit
 *   model       the model name is not available to this key
 *   rate_limit  too many requests right now
 *   other       anything else; see the function logs
 */
export async function GET() {
  await connection(); // always run at request time, never at build time
  return Response.json(await checkModel(), { headers: { "cache-control": "no-store" } });
}
