import type { Atom, PatternFields } from "../types/atom";
import type {
  ClosedWorldPredicate,
  OpenWorldPredicate,
  PredicateBase,
  PredicateMetadata,
  PredicateWorld,
} from "../types/predicate";
import type { PredicateSchema } from "../types/schema";

function makePredicate<const Schema extends PredicateSchema, const World extends PredicateWorld>(
  name: string,
  params: Schema,
  world: World,
  metadata?: PredicateMetadata,
): PredicateBase<Schema> & Readonly<{ world: World }> {
  type DeclaredPredicate = PredicateBase<Schema> & Readonly<{ world: World }>;

  const holder: { current?: DeclaredPredicate } = {};
  const construct = (fields: PatternFields<Schema>): Atom<Schema> => {
    const current = holder.current;
    if (current === undefined) {
      throw new Error(`Predicate ${name} was called before initialization`);
    }
    return { predicate: current, fields };
  };
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Runtime properties complete the callable predicate object below.
  const declared = construct as unknown as DeclaredPredicate;
  holder.current = declared;

  Object.defineProperties(declared, {
    name: { value: name },
    params: { value: params },
    paramNames: { value: Object.keys(params) },
    world: { value: world },
    ...(metadata === undefined ? {} : { metadata: { value: metadata } }),
  });

  return declared;
}

/**
 * Declare an open-world predicate with named fields: absent evidence leaves
 * queries `unknown` rather than `false`.
 */
function openPredicate<const Schema extends PredicateSchema>(
  name: string,
  params: Schema,
  metadata?: PredicateMetadata,
): OpenWorldPredicate<Schema> {
  return makePredicate(name, params, "open", metadata);
}

/**
 * Declare a closed-world predicate with named fields: absence of matching
 * evidence counts as `false`, and `not(...)` uses negation-as-failure.
 */
export function closedPredicate<const Schema extends PredicateSchema>(
  name: string,
  params: Schema,
  metadata?: PredicateMetadata,
): ClosedWorldPredicate<Schema> {
  return makePredicate(name, params, "closed", metadata);
}

/**
 * Declare a predicate with named fields, open-world: absent evidence leaves
 * queries `unknown` rather than `false` (use {@link closedPredicate} for
 * closed-world semantics). The returned declaration is callable: calling it
 * with field values or variables constructs an atom for use in evidence,
 * rules, and queries.
 *
 * @example
 * ```ts
 * class Person implements Entity {
 *   constructor(readonly id: string) {}
 * }
 *
 * const incomeFact = predicate("income_fact", {
 *   person: Person,
 *   year: Number,
 *   amountCents: Number,
 * });
 * const alice = new Person("alice");
 * const Amount = variable("Amount");
 *
 * const evidence = incomeFact({ person: alice, year: 2024, amountCents: 24_680_000 });
 * const pattern = incomeFact({ person: alice, year: 2024, amountCents: Amount });
 * ```
 */
export function predicate<const Schema extends PredicateSchema>(
  name: string,
  params: Schema,
  metadata?: PredicateMetadata,
): OpenWorldPredicate<Schema> {
  return openPredicate(name, params, metadata);
}
