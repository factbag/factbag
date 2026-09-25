import { runSanctionsDemo } from "./sanctions";
import { runFactorDemo } from "./factors";

const screening = await runSanctionsDemo();
const factors = await runFactorDemo();
const source = screening.review.evidence.metadata?.source;
if (source === undefined) {
  throw new Error("Expected a reviewable source");
}
const reviewed = screening.corpus.resolve(source);

process.stdout.write(
  [
    "",
    "FACTBAG · From documents to a decision you can explain",
    "Fictional structured records and scripted Jev distributions. No live screening or model calls.",
    "",
    `01  ${screening.company} · screening as of ${screening.asOf}`,
    `    Directly listed:  ${screening.directlyListed.value} (exact ID lookup in the imported snapshot)`,
    `    Nominee stake:    ${screening.ownershipBasisPoints / 100}% (structured register)`,
    `    Ownership route after structured imports: ${screening.initial.value}`,
    `    Four documents, ${screening.extractions} Jev document/predicate assessments`,
    `    After documents:  ${screening.disputed.value}`,
    `    Review source:    ${reviewed.chunk.text}`,
    `    Reviewer:         ${screening.review.reviewer}`,
    `    Decision:         ${screening.review.reason}`,
    `    Blocked under the demo policy after review: ${screening.resolved.value}`,
    "",
    "02  Transparent support scoring · demo-only helper",
    `    Structured inputs taken as given; documentary support: min(0.96, 0.87) = ${screening.score}`,
    `    Stronger evidence that the arrangement is in force: max(0.87, 0.92) = 0.92`,
    `    Updated conclusion support: min(0.96, 0.92) = ${screening.strengthenedScore}`,
    "    These are proof-support scores, not calibrated outcome probabilities.",
    "",
    "03  Which factors were reported to contribute?",
    ...factors.factors.map(
      (factor) =>
        `    ${factor.factor.padEnd(16)} ${factor.value.padEnd(10)} for: ${factor.positiveSupport?.toFixed(2) ?? "—"}  against: ${factor.negativeSupport?.toFixed(2) ?? "—"}`,
    ),
    `    Product route:    ${factors.productScore}`,
    `    Commercial route: ${factors.commercialScore}`,
    `    Best explanation: ${factors.score}`,
    `    Hide onboarding evidence in a separate view: ${factors.withoutOnboardingScore}`,
    "    Sensitivity of this explanation, not an estimated causal effect.",
    "",
    "04  Calibration · design discussion",
    "    Real outcomes → held-out evaluation → calibrated outcome probability.",
    "    Read packages/jev/docs/README.md for the walkthrough.",
    "",
  ].join("\n"),
);
