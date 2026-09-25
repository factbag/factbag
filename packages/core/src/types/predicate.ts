import type { Atom, GroundAtom, GroundFields, PatternFields } from "./atom";
import type { PredicateSchema } from "./schema";
import type { Annotations } from "./annotations";

/** Domain guidance for interpreting a predicate, available to evidence producers. */
export type PredicateMetadata = Readonly<{
  description: string;
  instructions?: string;
  parameters?: Readonly<Record<string, string>>;
  annotations?: Annotations;
}>;

/** Whether absence of evidence counts as falsity (`closed`) or unknown (`open`). */
export type PredicateWorld = "open" | "closed";

/** Predicate metadata carried by atoms and literals. */
export type PredicateDeclaration<Schema extends PredicateSchema = PredicateSchema> = Readonly<{
  readonly name: string;
  readonly params: Schema;
  readonly paramNames: readonly (keyof Schema & string)[];
  readonly world: PredicateWorld;
  readonly metadata?: PredicateMetadata;
}>;

/** A callable predicate declaration that constructs schema-typed atoms. */
export type PredicateBase<Schema extends PredicateSchema = PredicateSchema> =
  PredicateDeclaration<Schema> & {
    (fields: GroundFields<Schema>): GroundAtom<Schema>;
    (fields: PatternFields<Schema>): Atom<Schema>;
  };

/** A predicate whose unlisted atoms are unknown rather than false. */
export type OpenWorldPredicate<Schema extends PredicateSchema = PredicateSchema> =
  PredicateBase<Schema> & {
    readonly world: "open";
  };

/** A predicate whose relation is complete: absence of evidence means false. */
export type ClosedWorldPredicate<Schema extends PredicateSchema = PredicateSchema> =
  PredicateBase<Schema> & {
    readonly world: "closed";
  };

/** Any declared predicate, open- or closed-world. */
export type Predicate<Schema extends PredicateSchema = PredicateSchema> =
  | OpenWorldPredicate<Schema>
  | ClosedWorldPredicate<Schema>;
