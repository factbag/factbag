/**
 * Pins the LiveSolverTree scenario to the values the real solver produces for
 * every node in the diagram, so the tree view breaks loudly if core changes.
 */
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LiveSolverTree, solveTree } from "./LiveSolverTree";

describe("LiveSolverTree scenario", () => {
  it("is unknown when nothing is filed, with card_ok true by closed-world absence", () => {
    const judgments = solveTree({ audit: false, fines: false, frontDesk: false });
    expect(judgments.hasCard.value).toBe("unknown");
    expect(judgments.cardRevoked.value).toBe("false");
    expect(judgments.cardOk.value).toBe("true");
    expect(judgments.mayBorrow.value).toBe("unknown");
  });

  it("is true with only the front desk filing", () => {
    const judgments = solveTree({ audit: false, fines: false, frontDesk: true });
    expect(judgments.hasCard.value).toBe("true");
    expect(judgments.mayBorrow.value).toBe("true");
  });

  it("is false with only the audit denial", () => {
    const judgments = solveTree({ audit: true, fines: false, frontDesk: false });
    expect(judgments.hasCard.value).toBe("false");
    expect(judgments.mayBorrow.value).toBe("false");
  });

  it("flips card_ok false when the revocation is filed", () => {
    const judgments = solveTree({ audit: false, fines: true, frontDesk: false });
    expect(judgments.cardRevoked.value).toBe("true");
    expect(judgments.cardOk.value).toBe("false");
    expect(judgments.mayBorrow.value).toBe("false");
  });

  it("is conflicted when the card filings disagree", () => {
    const judgments = solveTree({ audit: true, fines: false, frontDesk: true });
    expect(judgments.hasCard.value).toBe("conflicted");
    expect(judgments.mayBorrow.value).toBe("conflicted");
  });

  it("lets a revocation sink even a proven card", () => {
    const judgments = solveTree({ audit: false, fines: true, frontDesk: true });
    expect(judgments.hasCard.value).toBe("true");
    expect(judgments.cardOk.value).toBe("false");
    expect(judgments.mayBorrow.value).toBe("false");
  });

  it("is false when both branches fail", () => {
    const judgments = solveTree({ audit: true, fines: true, frontDesk: false });
    expect(judgments.hasCard.value).toBe("false");
    expect(judgments.cardOk.value).toBe("false");
    expect(judgments.mayBorrow.value).toBe("false");
  });

  it("lets a revocation sink even a conflicted card", () => {
    const judgments = solveTree({ audit: true, fines: true, frontDesk: true });
    expect(judgments.hasCard.value).toBe("conflicted");
    expect(judgments.mayBorrow.value).toBe("false");
  });

  it("renders every node of the diagram", () => {
    const html = renderToString(createElement(LiveSolverTree));
    expect(html).toContain("has_card(mia)");
    expect(html).toContain("card_revoked(mia)");
    expect(html).toContain("card_ok(mia)");
    expect(html).toContain("may_borrow(mia)");
    expect(html).toContain("May Mia borrow books?");
  });
});
