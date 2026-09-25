import type { GroundAtom } from "../types/atom";
import type { AnyLiteral } from "../types/literal";
import type { QueryJudgment } from "../types/judgment";
import type { AnyRule } from "../types/rule";
import type { PredicateSchema } from "../types/schema";
import { assert } from "../utils/assert";
import { solveQueryAll } from "./solve-all";

export function solveQuery<Schema extends PredicateSchema>(
  literals: readonly AnyLiteral[],
  rules: readonly AnyRule[],
  atom: GroundAtom<Schema>,
): QueryJudgment<Schema> {
  const results = solveQueryAll(literals, rules, atom);
  const [result] = results;

  assert(result !== undefined, "Ground query must produce one result");

  return result;
}
