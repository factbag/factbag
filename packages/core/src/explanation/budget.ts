import { undecisiveIn } from "./relevance";
import type { Explanation } from "./types";

/**
 * The explanation cut down to its `budget` claims most worth a reader's attention, the
 * conclusion first. A claim that rests on claims left out names them in `notShown`.
 *
 * A claim is as far from the conclusion as the fewest undecisive claims on the way to
 * it, then as the number of claims on the way. So what decided the conclusion is kept
 * before anything that did not, the conditions of the conclusion's own rule before those
 * of a rule three levels down, and no claim is kept without the claim that rests on it.
 *
 * The budget counts claims as they are written out, so a claim that two others rest on
 * counts under each: the result written as JSON has at most `budget` nodes.
 */
export function withinBudget(explanation: Explanation, budget: number): Explanation {
  const root: Kept = { source: explanation, children: new Map() };
  const frontier: Candidate[] = candidates(root, [0, 0]);
  for (let kept = 1; kept < budget; kept++) {
    const nearest = frontier.reduce<Candidate | undefined>(
      (best, candidate) =>
        best === undefined || nearer(candidate.distance, best.distance) ? candidate : best,
      undefined,
    );
    if (nearest === undefined) {
      break;
    }
    frontier.splice(frontier.indexOf(nearest), 1);
    const child: Kept = { source: nearest.source, children: new Map() };
    nearest.under.children.set(nearest.source, child);
    frontier.push(...candidates(child, nearest.distance));
  }
  return write(root);
}

/** A claim kept within the budget, and those it rests on that were kept under it. */
type Kept = { source: Explanation; children: Map<Explanation, Kept> };

type Distance = readonly [undecisive: number, depth: number];

/** A claim that could be kept next, under the kept claim that rests on it. */
type Candidate = Readonly<{ source: Explanation; under: Kept; distance: Distance }>;

function nearer(a: Distance, b: Distance): boolean {
  return a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);
}

function candidates(kept: Kept, distance: Distance): Candidate[] {
  const { source } = kept;
  const undecisive = undecisiveIn(source);
  return ("given" in source ? source.given : []).map((child) => ({
    source: child,
    under: kept,
    distance: [distance[0] + (undecisive.has(child) ? 1 : 0), distance[1] + 1],
  }));
}

function write(kept: Kept): Explanation {
  const { source } = kept;
  if (!("given" in source)) {
    return source;
  }
  const given: Explanation[] = [];
  const notShown: string[] = [];
  for (const child of source.given) {
    const keptChild = kept.children.get(child);
    if (keptChild === undefined) {
      notShown.push(child.claim);
    } else {
      given.push(write(keptChild));
    }
  }
  return notShown.length === 0
    ? { ...source, given }
    : { ...source, given, notShown: [...new Set(notShown)] };
}
