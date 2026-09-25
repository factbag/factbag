import { and, enumeration, or, predicate } from "@factbag/core/dsl";
import { KnowledgeBase } from "@factbag/core/kb";
import { query } from "@factbag/core/query";
import type { GoalValue, Judgment } from "@factbag/core/query";
import { Corpus } from "@factbag/corpus";
import { guard } from "@factbag/guards";
import { classifier } from "../src/classifier";
import { distribution } from "./fixtures";
import { TypeSafeClient } from "@typesafe-ai/sdk";
import { mockJev } from "./mock-jev";
import type { Assessment, DemoAnswer, Fixture } from "./fixtures";
import { supportScore } from "./support-score";

type FactorResult = Readonly<{
  factor: string;
  value: GoalValue;
  positiveSupport: number | null;
  negativeSupport: number | null;
  source: string;
}>;

export type FactorDemo = Readonly<{
  corpus: Corpus;
  factors: readonly FactorResult[];
  product: Judgment;
  commercial: Judgment;
  conclusion: Judgment;
  productScore: number | null;
  commercialScore: number | null;
  score: number | null;
  withoutOnboardingScore: number | null;
}>;

/** Retrospective, documented contribution; not a statistical causal-effect estimate. */
export async function runFactorDemo(
  overrides: Readonly<Record<string, DemoAnswer>> = {},
): Promise<FactorDemo> {
  const corpus = new Corpus();
  let kb = new KnowledgeBase();
  const subject = { customer: "Cobalt", event: "cancellation-2026-09-01" } as const;
  const factorsToReview = enumeration<string>(
    "reliability",
    "onboarding",
    "billing",
    "price",
    "competition",
  );
  const contributed = predicate(
    "contributed_to_dropoff",
    {
      customer: enumeration(subject.customer),
      event: enumeration(subject.event),
      factor: factorsToReview,
    },
    {
      description:
        "The document reports that this factor contributed to this customer's specific cancellation event.",
      instructions:
        "Judge contribution to the cancellation, not whether the factor is mentioned. ASSERT requires a reported contribution; DENY requires an explicit statement that it did not contribute. Silence or an unrelated complaint is IRRELEVANT. Multiple factors may contribute.",
      parameters: {
        customer: "Customer identifier",
        event: "Specific cancellation event",
        factor: "Candidate contributing factor",
      },
    },
  );
  const cancelled = predicate("customer_cancelled", { customer: String, event: String });
  const cancellationRecord = { ...subject, cancelledAt: "2026-09-01", status: "cancelled" };
  const eventDocument = corpus.add({
    documentId: "customer-system-cancellation",
    text: JSON.stringify(cancellationRecord, null, 2),
    metadata: { kind: "structured" },
  });
  const eventSource = corpus.slice(eventDocument, { start: 0, end: eventDocument.text.length });
  // The customer system establishes the event. Jev only assesses the reasons reported in text.
  kb.asserts(cancelled(subject), {
    source: eventSource.id,
    scores: { support: 1 },
    annotations: { ingestion: { kind: "structured", method: "customer-event-record" } },
  });
  const names = factorsToReview.values;
  if (Object.keys(overrides).some((name) => !names.includes(name))) {
    throw new Error("Unknown factor fixture override");
  }
  const answers: Readonly<Record<string, DemoAnswer>> = {
    reliability: distribution(0.94, 0.02, 0.04),
    onboarding: distribution(0.82, 0.04, 0.14),
    billing: distribution(0.76, 0.06, 0.18),
    price: distribution(0.03, 0.91, 0.06),
    competition: distribution(0.01, 0.01, 0.98),
    ...overrides,
  };
  const text =
    "Cobalt's exit interview for the 2026-09-01 cancellation: recurring outages and a failed onboarding each contributed to leaving; billing disputes also contributed, but the subscription price did not.";
  corpus.add({ documentId: "cobalt-exit-interview", text });
  const candidates = (factorAnswers: Readonly<Record<string, DemoAnswer>>): Fixture["answers"] =>
    Object.fromEntries(
      Object.entries(factorAnswers).map(([factor, answer], index) => [
        `candidate_${index}`,
        { fields: { ...subject, factor }, answer },
      ]),
    );
  const assessments: Assessment[] = [];
  using mock = mockJev([{ text, predicate: contributed.name, answers: candidates(answers) }]);
  const run = classifier(
    corpus.filter((candidate) => candidate.metadata["kind"] !== "structured"),
    guard(kb).permit("assert", contributed).permit("deny", contributed),
    {
      client: new TypeSafeClient(mock.clientOptions),
      admission: { minimumProbability: 0.3, ambiguityMargin: 0.05 },
    },
  );
  for (const job of run) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- This demo chooses sequential execution.
    assessments.push(await job.execute());
  }
  kb = run.kb;
  const product = predicate("documented_product_breakdown", { customer: String, event: String });
  const commercial = predicate("documented_commercial_friction", {
    customer: String,
    event: String,
  });
  const explained = predicate("documented_dropoff_explanation", {
    customer: String,
    event: String,
  });
  const defineRules = (target: KnowledgeBase): void => {
    target
      .rule(product(subject))
      .iff(
        and(
          contributed({ ...subject, factor: "reliability" }),
          contributed({ ...subject, factor: "onboarding" }),
        ),
      );
    target
      .rule(commercial(subject))
      .iff(
        or(
          contributed({ ...subject, factor: "billing" }),
          contributed({ ...subject, factor: "price" }),
        ),
      );
    target
      .rule(explained(subject))
      .iff(and(cancelled(subject), or(product(subject), commercial(subject))));
  };
  defineRules(kb);
  const factors = assessments
    .flatMap((result) =>
      result.assessments.map((assessment) => ({ assessment, source: result.source })),
    )
    .map(({ assessment, source }): FactorResult => {
      const factor = assessment.atom.fields["factor"];
      if (typeof factor !== "string") {
        throw new Error("Expected a grounded factor name");
      }
      const value = query(kb, contributed({ ...subject, factor })).value;
      // Keep both sides: a factor can need review just like any other claim.
      const hasPositive = assessment.literals.some((literal) => literal.sign === "+");
      const hasNegative = assessment.literals.some((literal) => literal.sign === "-");
      return {
        factor,
        value,
        positiveSupport: hasPositive ? assessment.answer.probabilities.ASSERT : null,
        negativeSupport: hasNegative ? assessment.answer.probabilities.DENY : null,
        source,
      };
    });
  const productJudgment = query(kb, product(subject));
  const commercialJudgment = query(kb, commercial(subject));
  const conclusion = query(kb, explained(subject));

  // A separate KB gives a reversible sensitivity view; the original evidence stays intact.
  const sensitivity = new KnowledgeBase();
  for (const literal of kb.literals()) {
    if (literal.atom.fields["factor"] !== "onboarding") {
      if (literal.sign === "+") {
        sensitivity.asserts(literal.atom, literal.metadata);
      } else {
        sensitivity.denies(literal.atom, literal.metadata);
      }
    }
  }
  defineRules(sensitivity);
  return {
    corpus,
    factors,
    product: productJudgment,
    commercial: commercialJudgment,
    conclusion,
    productScore: supportScore(productJudgment),
    commercialScore: supportScore(commercialJudgment),
    score: supportScore(conclusion),
    withoutOnboardingScore: supportScore(query(sensitivity, explained(subject))),
  };
}
