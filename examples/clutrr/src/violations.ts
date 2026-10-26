/**
 * What the extracted facts may not say together, as derived predicates the recheck
 * resolver (`@factbag/jev/recheck`) can trace back to their evidence.
 *
 * The one constraint here is the benchmark's: CLUTRR's generator draws a family graph in
 * which any two people stand in one relation, labels each query with that one relation,
 * and its rules file composes a single key for a path. So any two people are related in at
 * most one way, and a knowledge base that derives two relations between the same two
 * people holds a fact the story does not state. Which one is not for the rules to say: the
 * resolver rereads the facts behind both derivations against the passage and keeps what
 * the text states.
 *
 * The constraint comes in two strengths. `stated_twice` fires close to the reading: two
 * different relations stated between the same pair. `conflicting_relations` fires on the
 * conclusions: two different relations derived for the same pair, through however many
 * rules, which catches a spurious fact anywhere along the chain and subsumes the first.
 * Both are a property of the benchmark's data, not of families in general, where a person
 * can be both a parent and, by remarriage, a parent-in-law of the same person. They live
 * here, in the example, for that reason.
 */
import { and, closedPredicate, or, variable } from "@factbag/core/dsl";
import type { Atom, Formula } from "@factbag/core/dsl";
import type { KnowledgeBase } from "@factbag/core/kb";
import { RELATION_KEYS, RELATIONS } from "./kinship";
import {
  grandparent_of,
  parent_in_law_of,
  parent_of,
  Person,
  sibling_in_law_of,
  sibling_of,
  spouse_of,
  uncle_or_aunt_of,
} from "./schema";

/** Two different stated relations between a and b. Derived, never asserted. */
export const stated_twice = closedPredicate("stated_twice", { a: Person, b: Person });

/** Two different relations derived from a to b, by whatever path. Derived, never asserted. */
export const conflicting_relations = closedPredicate("conflicting_relations", {
  a: Person,
  b: Person,
});

const A = variable("A");
const B = variable("B");

/** A fact atom or a formula over atoms. */
type Alternative = Atom | Formula<boolean, readonly unknown[]>;

/**
 * The eleven relations a story may state between A and B, each as the fact atoms that
 * state it: an ordered predicate read each way is two relations, a symmetric one in either
 * order is one.
 */
function statedRelations(): readonly (readonly Alternative[])[] {
  return [
    [parent_of({ parent: A, child: B })],
    [parent_of({ parent: B, child: A })],
    [spouse_of({ a: A, b: B }), spouse_of({ a: B, b: A })],
    [sibling_of({ a: A, b: B }), sibling_of({ a: B, b: A })],
    [grandparent_of({ grandparent: A, grandchild: B })],
    [grandparent_of({ grandparent: B, grandchild: A })],
    [parent_in_law_of({ parent_in_law: A, child_in_law: B })],
    [parent_in_law_of({ parent_in_law: B, child_in_law: A })],
    [sibling_in_law_of({ a: A, b: B }), sibling_in_law_of({ a: B, b: A })],
    [uncle_or_aunt_of({ uncle_or_aunt: A, nibling: B })],
    [uncle_or_aunt_of({ uncle_or_aunt: B, nibling: A })],
  ];
}

function anyOf(alternatives: readonly Alternative[]): Alternative {
  const [only] = alternatives;
  return alternatives.length === 1 && only !== undefined ? only : or(...alternatives);
}

/**
 * Add the exclusivity constraints to a knowledge base holding the fact predicates and the
 * kinship rules.
 */
export function defineViolations(kb: KnowledgeBase): void {
  const relations = statedRelations();
  const statedPairs: Alternative[] = [];
  for (const [index, first] of relations.entries()) {
    for (const second of relations.slice(index + 1)) {
      statedPairs.push(and(anyOf(first), anyOf(second)));
    }
  }
  kb.rule(stated_twice({ a: A, b: B })).iff(or(...statedPairs));
  const derivedPairs: Alternative[] = [];
  for (const [index, first] of RELATION_KEYS.entries()) {
    for (const second of RELATION_KEYS.slice(index + 1)) {
      derivedPairs.push(and(RELATIONS[first]({ a: A, b: B }), RELATIONS[second]({ a: A, b: B })));
    }
  }
  kb.rule(conflicting_relations({ a: A, b: B })).iff(or(...derivedPairs));
}

/**
 * The violation queries the resolver derives: every pair stated twice, and, for the queried
 * pair, two derived relations.
 *
 * The derived constraint is asked for the queried pair only, not for every pair, because the
 * benchmark's rules are not sound enough to serve as a constraint on their own: they compose
 * "my child's grandparent" to "my parent", which may equally be my parent-in-law, so a
 * consistent family with a spouse, a child and a grandparent derives two relations for some
 * pair and would send its true facts back for rereading. On the two development samples the
 * constraint over every pair fired in 8 and 13 stories, 6 and 7 of them already answered
 * correctly, and 70 of the 89 facts it reread were gold; asked for the queried pair it fired
 * in 2 and 5 stories, none of them correct, and reread 28 gold facts beside 9 spurious ones.
 * So the question decides where to look again: when it has two answers, the facts behind
 * both are reread, and a question with one answer disturbs nothing.
 */
export function violationQueries(pair?: Readonly<{ a: Person; b: Person }>): readonly Atom[] {
  return [
    stated_twice({ a: A, b: B }),
    ...(pair === undefined ? [] : [conflicting_relations({ a: pair.a, b: pair.b })]),
  ];
}
