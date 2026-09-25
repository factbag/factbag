import type { Atom, GroundAtom } from "../types/atom";
import type { KnowledgeBase } from "../knowledge-base/knowledge-base";
import type { QueryAllJudgment, QueryJudgment } from "../types/judgment";
import type { PredicateSchema } from "../types/schema";
import { solveQuery } from "../solver/solve";
import { solveQueryAll } from "../solver/solve-all";

/**
 * Evaluate one grounded atom against a knowledge base.
 *
 * @remarks
 * `query` names exactly one proposition — it is not a first-match shorthand
 * for {@link queryAll}.
 *
 * @returns A four-valued {@link Judgment} — `true`, `false`, `unknown`, or
 * `conflicted` — carrying the proof-support tree for the winning value.
 *
 * @throws {@link ProgrammerError} subclasses when the program shape is
 * invalid, e.g. rule bodies using unbound variables or unconstructive
 * recursion.
 *
 * @example
 * ```ts
 * kb.asserts(passedMedicalSchool({ person: alice }), { source: "registry" });
 * kb.asserts(hasActiveLicense({ person: alice }), { source: "license_board" });
 * kb.rule(doctor({ person: P })).iff(
 *   and(passedMedicalSchool({ person: P }), hasActiveLicense({ person: P })),
 * );
 *
 * const judgment = query(kb, doctor({ person: alice }));
 * judgment.value; // "true"
 * ```
 */
export function query<Schema extends PredicateSchema>(
  kb: KnowledgeBase,
  atom: GroundAtom<Schema>,
): QueryJudgment<Schema> {
  return solveQuery(kb.literals(), kb.rules(), atom);
}

/**
 * Evaluate an atom pattern against a knowledge base, yielding one judgment
 * per matching ground atom — zero, one, or many.
 *
 * @returns One {@link Judgment} per match, each carrying the variable
 * bindings that ground the pattern.
 *
 * @example
 * ```ts
 * for (const judgment of queryAll(kb, doctor({ person: P }))) {
 *   judgment.value; // "true" | "false" | "unknown" | "conflicted"
 *   judgment.bindings; // e.g. [[P, alice]]
 * }
 * ```
 */
export function queryAll<Schema extends PredicateSchema>(
  kb: KnowledgeBase,
  pattern: Atom<Schema>,
): QueryAllJudgment<Schema> {
  return solveQueryAll(kb.literals(), kb.rules(), pattern);
}
