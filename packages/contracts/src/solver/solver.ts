import type { Atom, GroundAtom } from "../entities/atom";
import type { QueryJudgment } from "./judgment";
import type { Program } from "../entities/program";

/**
 * A reasoning engine. It takes contract data and returns contract data, so
 * any implementation can stand in for another.
 */
export type Solver = Readonly<{
  /** Evaluate one ground atom. */
  query: (program: Program, atom: GroundAtom) => QueryJudgment;
  /** Evaluate a pattern, giving one judgment per ground atom that matches it. */
  queryAll: (program: Program, pattern: Atom) => readonly QueryJudgment[];
}>;
