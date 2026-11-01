import type { ChoiceResponse } from "@typesafe-ai/sdk";
import type { Outcome } from "../src/types/model";

/** A Jev wire answer to one classification question. */
type EvidenceChoice = ChoiceResponse<Record<Outcome, string>>;
export type { EvidenceChoice as DemoAnswer };

export type Fixture = Readonly<{
  text: string;
  predicate: string;
  answers: Readonly<
    Record<string, Readonly<{ fields: Readonly<Record<string, unknown>>; answer: EvidenceChoice }>>
  >;
}>;

/** Invented distributions for a reproducible walkthrough, not measured Jev output. */
export function distribution(assert: number, deny: number, irrelevant: number): EvidenceChoice {
  const probabilities = { ASSERT: assert, DENY: deny, IRRELEVANT: irrelevant };
  const outcomes: readonly Outcome[] = ["ASSERT", "DENY", "IRRELEVANT"];
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
