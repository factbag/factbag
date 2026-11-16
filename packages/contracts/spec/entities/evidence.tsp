import "@typespec/json-schema";
import "./atom.tsp";

using TypeSpec.JsonSchema;

namespace Factbag.Contracts;

/** JSON data carried without interpretation. */
union AnnotationValue {
  null,
  boolean,
  float64,
  string,
  AnnotationValue[],
  Record<AnnotationValue>,
}

/** Application-defined annotations. */
alias Annotations = Record<AnnotationValue>;

/** Where accepted evidence came from. */
model EvidenceMetadata {
  /** Name of the system or document the fact came from. */
  source?: string;

  /** Quotation or reference into the supporting material. */
  citation?: string;

  /** The asserter's stated reason for accepting the fact. */
  justification?: string;

  /** Named numeric scores, stored without being combined or interpreted. */
  scores?: Record<float64>;

  /** Application-specific annotations, retained on supporting evidence in judgments. */
  annotations?: Annotations;
}

/** Whether evidence asserts or denies its atom. */
enum Sign {
  asserted,
  denied,
}

/** Accepted evidence: a ground atom asserted or denied, with where it came from. */
model Literal {
  sign: Sign;
  atom: GroundAtom;
  metadata?: EvidenceMetadata;
}

// Predicates
