/**
 * Pins the ProofTreeExplorer scenario to the verdicts the real solver
 * produces, so the widget's narrative breaks loudly if core semantics change.
 */
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ProofTreeExplorer, solve } from "./ProofTreeExplorer";

describe("ProofTreeExplorer scenario", () => {
  it("is eligible on an empty registry (closed-world absence)", () => {
    const { explanation, judgment } = solve({ appeals: false, registry: false });
    expect(judgment.value).toBe("true");
    expect(explanation.claim).toBe("eligible(drew) = true");
  });

  it("is ineligible with only the registry filing", () => {
    const { judgment } = solve({ appeals: false, registry: true });
    expect(judgment.value).toBe("false");
  });

  it("is eligible with only the appeals denial", () => {
    const { judgment } = solve({ appeals: true, registry: false });
    expect(judgment.value).toBe("true");
  });

  it("is conflicted when both filings are on record — not() preserves the conflict", () => {
    const { judgment } = solve({ appeals: true, registry: true });
    expect(judgment.value).toBe("conflicted");
  });

  it("renders the solver's judgment through the live viewer, both quotes attached", () => {
    const html = renderToString(createElement(ProofTreeExplorer));
    expect(html).toContain('data-proof-id="eligible(drew)"');
    expect(html).toContain("active_sanction(drew)");
    expect(html).toContain("conflicted");
    expect(html).toContain("sanctions_registry");
    expect(html).toContain("appeals_board");
    expect(html).toContain("Drew appears on the active sanctions list.");
    expect(html).toContain("Drew&#x27;s sanction was overturned on appeal.");
  });
});
