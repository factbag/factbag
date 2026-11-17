import "@typespec/json-schema";
import "./evidence.tsp";
import "./predicate.tsp";
import "./rule.tsp";
import "./value.tsp";

using TypeSpec.JsonSchema;

namespace Factbag.Contracts;

/** What a solver reasons over: the vocabulary, the accepted evidence, and the rules. */
model Program {
  /** Every predicate the evidence and rules use, each name appearing once. */
  predicates: Predicate[];

  literals: Literal[];
  rules: Rule[];
}

/** A whole knowledge base as a document: a versioned program plus its registered entities. */
model KnowledgeBaseDocument {
  kind: "KnowledgeBase";

  /** Format version. */
  apiVersion: "factbag/v1alpha1";

  /** Entities registered with the knowledge base. */
  entities: EntityRef[];

  ...Program;
}

// Solver results
