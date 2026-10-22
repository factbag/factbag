import { describe, expect, it } from "vitest";
import { bootstrap, score } from "./metrics";
import type { Judgment } from "./metrics";

const judgments: Judgment[] = [
  { contractId: 1, hypothesisId: "nda-1", gold: "Entailment", predicted: "Entailment" },
  { contractId: 1, hypothesisId: "nda-2", gold: "Contradiction", predicted: "Entailment" },
  { contractId: 2, hypothesisId: "nda-1", gold: "NotMentioned", predicted: "NotMentioned" },
  { contractId: 2, hypothesisId: "nda-2", gold: "NotMentioned", predicted: undefined },
];

describe("score", () => {
  it("counts invalid answers as wrong and computes per-class scores", () => {
    const metrics = score(judgments);
    expect(metrics.accuracy).toBe(0.5);
    expect(metrics.invalid).toBe(1);
    expect(metrics.classes.Entailment).toEqual({
      precision: 0.5,
      recall: 1,
      f1: 2 / 3,
      support: 1,
    });
    expect(metrics.classes.Contradiction).toEqual({ precision: 0, recall: 0, f1: 0, support: 1 });
    expect(metrics.classes.NotMentioned).toEqual({
      precision: 1,
      recall: 0.5,
      f1: 2 / 3,
      support: 2,
    });
    expect(metrics.macroF1).toBeCloseTo(4 / 9);
  });
});

describe("bootstrap", () => {
  it("is deterministic and brackets the point estimate", () => {
    const a = bootstrap(judgments, 200);
    const b = bootstrap(judgments, 200);
    expect(a).toEqual(b);
    expect(a.accuracy[0]).toBeLessThanOrEqual(0.5);
    expect(a.accuracy[1]).toBeGreaterThanOrEqual(0.5);
  });
});
