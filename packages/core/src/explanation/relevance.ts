import type { Explanation } from "./types";

/**
 * Which of the claims an explanation rests on did not decide its value.
 *
 * A false conjunction is false because of its false conditions; the true ones were
 * evaluated and changed nothing. That is not part of what an explanation says, so it is
 * kept beside the explanation rather than in it, for writing an explanation out within a
 * budget: what decided a claim is worth a reader's attention before what did not.
 */
const undecisive = new WeakMap<Explanation, ReadonlySet<Explanation>>();

/** Record the claims under `explanation` that did not decide its value. */
export function noteUndecisive(explanation: Explanation, claims: Iterable<Explanation>): void {
  const noted = new Set(claims);
  if (noted.size > 0) {
    undecisive.set(explanation, noted);
  }
}

/** The claims under `explanation` that did not decide its value. None, if none were recorded. */
export function undecisiveIn(explanation: Explanation): ReadonlySet<Explanation> {
  return undecisive.get(explanation) ?? NONE;
}

const NONE: ReadonlySet<Explanation> = new Set();
