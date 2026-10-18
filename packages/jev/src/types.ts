import type {
  Entity,
  EnumType,
  GroundAtom,
  PredicateDeclaration,
  RuntimeConstructor,
} from "@factbag/core/dsl";
import type { Operation } from "@factbag/guards";
import type { ChoiceResponse, JsonValue } from "@typesafe-ai/sdk";

/**
 * Field domains accepted after registration. Open-ended scalar constructors are excluded.
 *
 * @beta
 */
export type SupportedField = BooleanConstructor | EnumType | RuntimeConstructor<Entity>;
/**
 * A predicate refined during registration to supported finite field domains.
 *
 * @beta
 */
export type SupportedPredicate = PredicateDeclaration<Readonly<Record<string, SupportedField>>>;

/** A permitted effect on a validated predicate: any guarded operation that writes. */
export type Action = Exclude<Operation, "query">;

/**
 * Interpretations of a passage's relationship to one complete fact.
 *
 * @beta
 */
export type Outcome = "ASSERT" | "DENY" | "IRRELEVANT";
/**
 * Validated response retaining the full three-way distribution.
 *
 * @beta
 */
export type EvidenceChoice = ChoiceResponse<Record<Outcome, string>>;

/** One ground atom the model is asked about, with its fields encoded for the request. */
export type Candidate = Readonly<{
  id: string;
  atom: GroundAtom;
  fields: Record<string, JsonValue>;
}>;

/** Everything needed to classify one validated predicate, fixed at run start. */
export type Tool = Readonly<{
  predicate: SupportedPredicate;
  actions: ReadonlySet<Action>;
  candidates: readonly Candidate[];
}>;

/** A validated model response for one tool and chunk; nothing has been written yet. */
export type ToolResult = Readonly<{
  tool: Tool;
  /** The chunk id the answers were given for. */
  source: string;
  answers: readonly Readonly<{
    candidate: Candidate;
    answer: EvidenceChoice;
  }>[];
}>;

/**
 * Whether one passage's evidence survives, judged against the passages it conflicts with.
 *
 * @beta
 */
export type Standing = "KEEP" | "RETRACT";
/**
 * Validated response retaining the full distribution.
 *
 * @beta
 */
export type StandingChoice = ChoiceResponse<Record<Standing, string>>;
