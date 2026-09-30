/**
 * The scaffold widgets keep their hand-placed layouts but every value now
 * comes from solveScaffold — these renders break if the live path regresses.
 * The lattice semantics behind them are pinned in lib/live.test.ts.
 */
import { createElement, type JSX } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { EvaluationGraph } from "./EvaluationGraph";
import { EverydayDecision } from "./EverydayDecision";
import { TrialEligibilityTree } from "./TrialEligibilityTree";

/** SSR splits adjacent JSX text expressions with comment markers. */
function render(component: () => JSX.Element): string {
  return renderToString(createElement(component)).replaceAll("<!-- -->", "");
}

describe("scaffold widgets on the live solver", () => {
  it("EvaluationGraph: AND of (✓, ?, ✓, !) lands on unknown", () => {
    const html = render(EvaluationGraph);
    expect(html).toContain("H = unknown");
    expect(html).toContain("AND(✓, ?, ✓, !) = ?");
  });

  it("EverydayDecision: conflicting signals are reason enough to escalate", () => {
    const html = render(EverydayDecision);
    expect(html).toContain("Signals disagree — a person should look");
  });

  it("TrialEligibilityTree: the extended-window route carries eligibility", () => {
    const html = render(TrialEligibilityTree);
    expect(html).toContain("Yes — eligible");
  });
});
