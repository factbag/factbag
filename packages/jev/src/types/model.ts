import type { AnyAtom, Entity, GroundAtom, PredicateDeclaration, Scalar } from "@factbag/core/dsl";
import type { AnnotationValue } from "@factbag/core/kb";

/** How a passage bears on one complete candidate fact. */
export type Outcome = "ASSERT" | "DENY" | "IRRELEVANT";

/** Whether a conflicting passage's account still stands, judged with the others in view. */
export type Verdict = "KEEP" | "RETRACT";

/** Something whose relevance to a passage can be judged: a predicate or a single symbol. */
export type Subject =
  | { readonly declaration: PredicateDeclaration }
  | { readonly value: Scalar | Entity };

/** A model's probability for each label, with model-specific detail for provenance. */
export type Judgement<Label extends string> = {
  readonly probabilities: Readonly<Record<Label, number>>;
  /** Retained in evidence annotations under the model's name; never interpreted here. */
  readonly details: Readonly<Record<string, AnnotationValue>>;
};

/**
 * The judgements classification and resolution need from a language model, phrased in
 * Factbag terms. An implementation owns everything about talking to its model: request
 * shapes, prompts, batching, and validating answers. Callers own everything about using
 * the answers: thresholds, admission, and writing evidence.
 *
 * Every operation pairs each input with its answer, in input order, and rejects as a whole
 * if any answer is missing or invalid. Empty input resolves to empty output without asking.
 */
export type Model = {
  /** Namespace for this model's details in evidence annotations. */
  readonly name: string;

  /** The probability that the passage bears on each subject, affirmatively or negatively. */
  readonly relevance: <S extends Subject>(input: {
    text: string;
    subjects: readonly S[];
  }) => Promise<readonly { subject: S; relevance: number }[]>;

  /** How the passage bears on each candidate fact, each judged independently. */
  readonly classify: (input: {
    text: string;
    predicate: PredicateDeclaration;
    candidates: readonly GroundAtom[];
  }) => Promise<readonly { candidate: GroundAtom; judgement: Judgement<Outcome> }[]>;

  /** Whether each passage's account of a contested fact stands, read together. */
  readonly adjudicate: <P extends { readonly text: string }>(input: {
    atom: AnyAtom;
    passages: readonly P[];
  }) => Promise<readonly { passage: P; judgement: Judgement<Verdict> }[]>;
};
