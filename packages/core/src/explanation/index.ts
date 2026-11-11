/**
 * Explanations: convert a query judgment's proof into a compact, LLM-readable
 * claim/because/given structure.
 *
 * @packageDocumentation
 */
export { explainJudgment } from "./explain";
export type { ExplanationOptions } from "./explain";
export type {
  CompoundExplanation,
  DerivedExplanation,
  EvidenceExplanation,
  EvidenceReason,
  Explanation,
  ExplanationBase,
  TerminalExplanation,
} from "./types";
