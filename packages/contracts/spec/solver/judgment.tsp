import "@typespec/json-schema";
import "./goal.tsp";
import "../entities/evidence.tsp";
import "../entities/rule.tsp";
import "../entities/value.tsp";

using TypeSpec.JsonSchema;

namespace Factbag.Contracts;

/** The four values a goal can have. */
enum TruthValue {
  `true`,
  `false`,
  `unknown`,
  conflicted,
}

/** A variable an operation needed had no binding. */
model MissingBinding {
  kind: "missing-binding";
  variable: Variable;
}

/** Whether the evidence disagrees (`conflict`) or is missing (`unknown`). */
enum UnsettledKind {
  conflict,
  `unknown`,
}

/** Evidence the result depends on is conflicted or unknown. */
model UnsettledEvidence {
  kind: UnsettledKind;
  count?: float64;
}

/** An open-world predicate may have matches that are not recorded. */
model OpenWorld {
  kind: "open-world";
}

/** Why a result is not exact. */
@extension(
  "discriminator",
  #{
    propertyName: "kind",
    mapping: #{
      conflict: "UnsettledEvidence.json",
      `unknown`: "UnsettledEvidence.json",
      `open-world`: "OpenWorld.json",
      `missing-binding`: "MissingBinding.json",
    },
  }
)
@oneOf
union Uncertainty {
  UnsettledEvidence,
  OpenWorld,
  MissingBinding,
}

/** Lower and upper bounds on a number; an unbounded side is infinite. */
model NumericRange {
  lower: float64 | InfiniteNumber;
  upper: float64 | InfiniteNumber;
}

/** A count known only within bounds, with why it is not exact. */
model NumericRangeValue {
  kind: "numeric-range";
  ...NumericRange;
  uncertainty: Uncertainty[];
}

/** What a variable can be bound to: a value, or a count that is not exactly known. */
@oneOf
union BoundValue {
  Value,
  NumericRangeValue,
}

/** One variable assignment: the variable, then its value. */
alias Binding = [Variable, BoundValue];

/** Stored evidence for or against the atom. */
model EvidenceSupport {
  source: "evidence";
  literals: Literal[];
}

/** A closed-world predicate has no evidence for the atom. */
model ClosedWorldAbsenceSupport {
  source: "closed-world-absence";
}

/** A rule whose head matches the atom, with the judgment of its body. */
model RuleSupport {
  source: "rule";
  rule: Rule;
  body: Judgment;
}

/** The judgments of a compound goal's children. */
model SubgoalsSupport {
  source: "subgoals";
  judgments: Judgment[];
}

/** What a primitive operation was given and what it produced. */
model PrimitiveEvaluation {
  operation: string;
  operands: (BoundValue | MissingBinding)[];
  value: TruthValue;
  result?: BoundValue;
  results?: Binding[];
  range?: NumericRange;
  uncertainty?: Uncertainty[];
}

/** The evaluation of an arithmetic, comparison, or aggregate goal. */
model PrimitiveSupport {
  source: "primitive";
  evaluation: PrimitiveEvaluation;
}

/** One reason for a judgment's value. `source` says which. */
@extension(
  "discriminator",
  #{
    propertyName: "source",
    mapping: #{
      evidence: "EvidenceSupport.json",
      `closed-world-absence`: "ClosedWorldAbsenceSupport.json",
      rule: "RuleSupport.json",
      subgoals: "SubgoalsSupport.json",
      primitive: "PrimitiveSupport.json",
    },
  }
)
@oneOf
union Support {
  EvidenceSupport,
  ClosedWorldAbsenceSupport,
  RuleSupport,
  SubgoalsSupport,
  PrimitiveSupport,
}

/** A solver's verdict on one goal, with the proof behind it. */
model Judgment {
  goal: Goal;
  value: TruthValue;

  /** The variable assignments in scope for this goal. */
  bindings: Binding[];

  /** What supports the goal. */
  positive?: Support[];

  /** What refutes the goal. */
  negative?: Support[];

  /** The derivations that could not settle the goal. */
  inconclusive?: Support[];
}

/** The judgment a query returns: its goal is the ground atom that was asked about or matched. */
model QueryJudgment {
  ...OmitProperties<Judgment, "goal">;
  goal: AtomGoal;
}
