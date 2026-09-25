import type { ChoiceResponse } from "@typesafe-ai/sdk";
export type { Assessment } from "../src/jobs";

type EvidenceOutcome = "ASSERT" | "DENY" | "IRRELEVANT";

export type DemoAnswer = ChoiceResponse<Record<EvidenceOutcome, string>>;

export type Fixture = Readonly<{
  text: string;
  predicate: string;
  answers: Readonly<
    Record<string, Readonly<{ fields: Readonly<Record<string, unknown>>; answer: DemoAnswer }>>
  >;
}>;

/** Invented distributions for a reproducible walkthrough, not measured Jev output. */
export function distribution(assert: number, deny: number, irrelevant: number): DemoAnswer {
  const probabilities = { ASSERT: assert, DENY: deny, IRRELEVANT: irrelevant };
  const outcomes: readonly EvidenceOutcome[] = ["ASSERT", "DENY", "IRRELEVANT"];
  const choice = outcomes.reduce((best, next) =>
    probabilities[next] > probabilities[best] ? next : best,
  );
  return {
    type: "choice",
    choice,
    probabilities,
    // Deliberately distinct from the selected probability. This is a fixture too.
    confidence: 0.75,
  };
}
