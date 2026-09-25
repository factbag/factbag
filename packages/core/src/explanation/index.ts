/**
 * Explanations: convert a query judgment's proof tree into a compact,
 * LLM-readable claim/because/given structure.
 *
 * @packageDocumentation
 */
export { explainJudgment } from "./explain";
export type {
  CompoundExplanation,
  DerivedExplanation,
  EvidenceExplanation,
  EvidenceReason,
  Explanation,
  ExplanationBase,
  TerminalExplanation,
} from "./types";
