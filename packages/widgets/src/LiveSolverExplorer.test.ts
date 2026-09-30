/**
 * Pins the LiveSolverExplorer scenario to the verdicts the real solver
 * produces, so the widget's narrative breaks loudly if core semantics change.
 */
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LiveSolverExplorer, solve } from "./LiveSolverExplorer";

describe("LiveSolverExplorer scenario", () => {
  it("is unknown when nothing is filed (open-world silence)", () => {
    const { judgment } = solve({ audit: false, fines: false, frontDesk: false });
    expect(judgment.value).toBe("unknown");
  });

  it("is true with only the front desk filing (closed-world absence of revocation)", () => {
    const { explanation, judgment } = solve({ audit: false, fines: false, frontDesk: true });
    expect(judgment.value).toBe("true");
    expect(explanation.claim).toBe("may_borrow(mia) = true");
  });

  it("is false with only the audit denial", () => {
    const { judgment } = solve({ audit: true, fines: false, frontDesk: false });
    expect(judgment.value).toBe("false");
  });

  it("is false with only the revocation filing", () => {
    const { judgment } = solve({ audit: false, fines: true, frontDesk: false });
    expect(judgment.value).toBe("false");
  });

  it("is conflicted when the card filings disagree", () => {
    const { judgment } = solve({ audit: true, fines: false, frontDesk: true });
    expect(judgment.value).toBe("conflicted");
  });

  it("lets a revocation sink even a conflicted card (and() takes the worst value)", () => {
    const { judgment } = solve({ audit: true, fines: true, frontDesk: true });
    expect(judgment.value).toBe("false");
  });

  it("renders the judgment tree down to the quoted evidence", () => {
    const html = renderToString(createElement(LiveSolverExplorer));
    expect(html).toContain("may_borrow(mia)");
    expect(html).toContain("has_card(mia)");
    expect(html).toContain("Mia was issued card #4417 at the front desk.");
    expect(html).toContain("closed-world");
  });
});
