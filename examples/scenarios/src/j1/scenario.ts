import type { Scenario } from "../types";
import { createJ1Corpus } from "./corpus";
import type { J1Case } from "./corpus";
import { createJ1KB } from "./kb";

export { createJ1Scenario as default };

/** The tenure-track ground under §62.20(d)(1), not a complete eligibility determination. */
export function createJ1Scenario(
  caseName: J1Case = "positive",
): Scenario & ReturnType<typeof createJ1KB> {
  const base = createJ1KB();
  const {
    applicant,
    predicates: { disqualified },
  } = base;
  const { corpus, target } = createJ1Corpus(base, caseName);
  const values = {
    positive: "true",
    negative: "false",
    contradictory: "conflicted",
    "contradictory-document": "conflicted",
    neutral: "unknown",
  } as const;
  return {
    ...base,
    corpus,
    targets: [target],
    expected: [
      { atom: target, value: values[caseName] },
      // Conflicting support propagates; a denied premise alone does not negate a sufficient rule's head.
      {
        atom: disqualified({ person: applicant }),
        value:
          caseName === "contradictory" || caseName === "contradictory-document"
            ? "conflicted"
            : caseName === "positive"
              ? "true"
              : "unknown",
      },
    ],
  };
}
