/**
 * Smoke-renders every exported widget in its default state, so a widget that
 * throws on first paint (a solver call that no longer typechecks at runtime,
 * a missing lattice key) fails here rather than on the docs site.
 */
import { createElement, type JSX } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import * as widgets from "./index";

const WIDGETS: Record<string, () => JSX.Element> = {
  CountRangeExplorer: widgets.CountRangeExplorer,
  EvaluationGraph: widgets.EvaluationGraph,
  EverydayDecision: widgets.EverydayDecision,
  LiveSolverExplorer: widgets.LiveSolverExplorer,
  LiveSolverTree: widgets.LiveSolverTree,
  ProofTreeExplorer: widgets.ProofTreeExplorer,
  TrialEligibilityTree: widgets.TrialEligibilityTree,
};

describe("widgets", () => {
  it.each(Object.entries(WIDGETS))("%s renders in its default state", (_name, Widget) => {
    const html = renderToString(createElement(Widget));
    expect(html).toContain("<section");
  });

  it("renders in plain chrome without the card frame", () => {
    const framed = renderToString(createElement(widgets.EvaluationGraph));
    const plain = renderToString(
      createElement(widgets.WidgetChrome, {
        children: createElement(widgets.EvaluationGraph),
        variant: "plain",
      }),
    );
    expect(framed).toContain("rounded-3xl");
    expect(plain).not.toContain("rounded-3xl");
  });
});
