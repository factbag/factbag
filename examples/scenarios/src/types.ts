import type { GroundAtom, PredicateDeclaration } from "@factbag/core/dsl";
import type { Literal, KnowledgeBase } from "@factbag/core/kb";
import type { GoalValue } from "@factbag/core/query";
import type { Corpus, DocumentInput } from "@factbag/corpus";

/** Ground truth about a document, never input evidence in the base KB. */
export type ScenarioMetadata = {
  readonly kind: "evidence" | "neutral" | "near-miss";
  readonly scope: "shared" | "specific";
  readonly evidence: readonly Literal[];
  /** Explicitly reviewed as irrelevant to these grounded targets. */
  readonly irrelevantTo: readonly GroundAtom[];
};

/** Bound to a scenario's native entities and predicates; creates one document on demand. */
export type DocumentFactory = () => DocumentInput<ScenarioMetadata>;

/** Explicit selection groups. Exact, possibly multi-predicate evidence lives on each document. */
export type PredicateDocuments = {
  readonly predicate: PredicateDeclaration;
  readonly assert?: readonly DocumentFactory[];
  readonly deny?: readonly DocumentFactory[];
  readonly contradictory?: readonly DocumentFactory[];
  readonly nearMiss?: readonly DocumentFactory[];
};

/** Fresh inputs plus independently authored expectations for a named case. */
export type Scenario = {
  readonly kb: KnowledgeBase;
  readonly corpus: Corpus<ScenarioMetadata>;
  readonly targets: readonly GroundAtom[];
  readonly expected: readonly { readonly atom: GroundAtom; readonly value: GoalValue }[];
};
