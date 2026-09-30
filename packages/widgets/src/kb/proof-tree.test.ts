import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { contestedBoatJudgment, libraryCardJudgment } from "./fixtures";
import { ProofTree } from "./proof-tree";

describe("ProofTree", () => {
  it("renders a derivation down to quoted evidence and absence", () => {
    const html = renderToString(createElement(ProofTree, { judgment: libraryCardJudgment() }));
    expect(html).toContain("may_borrow(mia)");
    expect(html).toContain("has_card(mia)");
    expect(html).toContain("front_desk");
    expect(html).toContain("Mia was issued card #4417 at the front desk.");
    expect(html).toContain("closed-world: nothing on file");
    expect(html).toContain("because");
  });

  it("labels both sides of a conflict", () => {
    const html = renderToString(createElement(ProofTree, { judgment: contestedBoatJudgment() }));
    expect(html).toContain("conflicted");
    expect(html).toContain("ship_registry");
    expect(html).toContain("harbor_master");
  });

  it("keeps node identity stable across re-solves while values change", () => {
    const before = renderToString(createElement(ProofTree, { judgment: libraryCardJudgment() }));
    const after = renderToString(
      createElement(ProofTree, { judgment: libraryCardJudgment({ revoked: true }) }),
    );

    for (const html of [before, after]) {
      expect(html).toContain('data-proof-id="may_borrow(mia)"');
      expect(html).toContain("has_card(mia)");
    }
  });

  it("makes exactly the leaf atoms clickable when onAtomClick is given", () => {
    const judgment = libraryCardJudgment();
    const passive = renderToString(createElement(ProofTree, { judgment }));
    expect(passive).not.toContain('data-proof-click="atom"');

    const clicked: string[] = [];
    const active = renderToString(
      createElement(ProofTree, {
        judgment,
        onAtomClick: (atom) => {
          clicked.push(atom.predicate.name);
        },
      }),
    );
    // has_card(mia) and card_revoked(mia) are settled by evidence/silence;
    // may_borrow(mia) is a rule head and stays inert.
    expect(active.split('data-proof-click="atom"').length - 1).toBe(2);
  });
});
