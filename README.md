# Factbag

Turn documents into evidence and conclusions with [Jev](https://typesafe.ai/) and TypeScript.

Factbag uses TypeSafe AI’s Jev model to read passages and assess specific claims.
Those assessments become evidence in a knowledge base, alongside facts from your
application. You write the rules that connect them and query what follows.

Each piece of documentary evidence points back to its source passage. Conclusions
can be **true**, **false**, **conflicted**, or **unknown**. When documents disagree,
you can inspect the conflicting evidence, correct a particular fact, and query
the rules again.

> [!IMPORTANT]
> Factbag is an early alpha release and still pretty rough - APIs will definitely change.

## How it works

1. **Define the claims** you want Jev to assess, with descriptions of what counts
   as evidence.
2. **Add documents** to a corpus and choose which predicates Jev may assert or deny.
3. **Execute classification jobs.** Jev assesses whether each passage supports,
   contradicts, or is irrelevant to each candidate claim.
4. **Query the result.** Factbag combines admitted evidence with your existing
   facts and rules, retaining the sources behind the conclusion.

## Install

```sh
npm install factbag @typesafe-ai/sdk@^0.6.0
```

ESM only. Requires Node 22.18+ on the 22.x line, or Node 24 or 26.

Set your TypeSafe API key in the environment:

```sh
export TYPESAFE_API_KEY="your-api-key"
```

## From a document to a conclusion

### 1. Decide on your ruleset

Start with the criteria your application needs to apply. These might be your own
business rules or requirements set out in legislation or regulations. Translate
those criteria into an explicit ruleset: identify each condition, then specify
how the conditions combine to produce a conclusion.

Here, we're translating the individual-income route in the SEC's
[accredited-investor definition, 17 CFR § 230.501(a)(6)](<https://www.ecfr.gov/current/title-17/chapter-II/part-230/section-230.501#p-230.501(a)(6)>),
into three conditions:

- Individual income exceeded $200,000 in the first of the two most recent years.
- Individual income exceeded $200,000 in the second year.
- The person reasonably expects to reach the same income level in the current year.

All three must hold. We'll encode that conjunction as a rule, using 2024 and 2025
as the previous years and 2026 as the current year. This models one route in the
regulation; the joint-income and other qualification routes would need additional
rules.

The legal criteria become code we can inspect. Jev's role is to assess the evidence
for individual conditions; the ruleset determines what follows from them.

Jev reads the income documents and the investor's statement about this year's
expectations. We also import identity verification from an onboarding system.
Rules determine qualification and whether the investor is ready for review.

The snippets below build on each other in one TypeScript file.

### 2. Define the claims

Declare the facts we'll combine, and describe the claims Jev will assess.

```ts
import { and, enumeration, predicate, variable } from "factbag/dsl";
import { KnowledgeBase } from "factbag/kb";
import { query } from "factbag/query";
import { Corpus } from "factbag/corpus";
import { guard } from "factbag/guards";
import { classifier } from "factbag/jev/classifier";

const person = enumeration("Alice");

const hasIncomeOver200k = predicate(
  "has_income_over_200k",
  { person, year: enumeration("2024", "2025") },
  {
    description:
      "The person's total individual annual income exceeded USD 200,000 in the " +
      "specified year. Joint household income and forecasts do not count.",
  },
);

const expectsSameIncome = predicate(
  "expects_same_income",
  { person },
  {
    description:
      "The person reasonably expects their individual income in 2026 to remain " +
      "at least at the level earned in each of 2024 and 2025.",
  },
);

const isQualifiedInvestor = predicate("is_qualified_investor", { person });
const hasVerifiedIdentity = predicate("has_verified_identity", { person });
const isReadyForReview = predicate("is_ready_for_review", { person });
```

For predicates exposed to Jev, candidate values must be finite: use enumerations,
booleans, or registered entities rather than open-ended strings or numbers.
Here, Jev assesses Alice's income for 2024 and 2025 and her expected income for 2026.

### 3. Encode the ruleset

All three income conditions must hold for this route to qualification. Our
application also requires verified identity before sending an investor for review.

```ts
const investor = variable("investor");
const kb = new KnowledgeBase();

kb.rule(isQualifiedInvestor({ person: investor })).if(
  and(
    hasIncomeOver200k({ person: investor, year: "2024" }),
    hasIncomeOver200k({ person: investor, year: "2025" }),
    expectsSameIncome({ person: investor }),
  ),
);

kb.rule(isReadyForReview({ person: investor })).if(
  and(
    isQualifiedInvestor({ person: investor }),
    hasVerifiedIdentity({ person: investor }),
  ),
);
```

### 4. Import a known fact and add documents

Identity verification comes directly from our onboarding system. Income evidence
goes into the corpus for Jev to assess. Document text is elided below; supply the
full text of each record in your application.

```ts
kb.asserts(hasVerifiedIdentity({ person: "Alice" }), {
  source: "onboarding:alice",
});

const corpus = new Corpus();

corpus.add({ documentId: "alice-income-2024", text: "…" });
corpus.add({ documentId: "alice-income-2025", text: "…" });
corpus.add({ documentId: "alice-income-statement", text: "…" });
```

### 5. Ask Jev to assess the income evidence

Permit Jev to assert or deny the two income predicates. Identity verification
remains an imported fact; qualification is derived by the rule. Only
`job.execute()` makes a live request; the loop controls pacing.

```ts
const incomeEvidence = guard(kb)
  .permit("assert", hasIncomeOver200k)
  .permit("deny", hasIncomeOver200k)
  .permit("assert", expectsSameIncome)
  .permit("deny", expectsSameIncome);

const run = classifier(corpus, incomeEvidence);

for (const job of run) {
  const result = await job.execute(); // Makes a live Jev request.
  console.log(result.assessments);
}
```

### 6. Query the conclusion

The output knowledge base combines the imported fact and rules with the admitted
evidence. The input `kb` is unchanged.

```ts
const qualification = query(run.kb, isQualifiedInvestor({ person: "Alice" }));
const reviewReadiness = query(run.kb, isReadyForReview({ person: "Alice" }));

console.log(qualification.value);
console.log(reviewReadiness.value);
// Both are "true" if Jev admits supporting evidence for all three income claims.
```

Results can be `true`, `false`, `conflicted`, or
`unknown`, depending on the evidence admitted.

## Go further

- [Introducing Factbag](https://blog.du-pless.is/introducing-factbag): how and why
  to use it.
- [Jev and the Art of Truth Maintenance](https://blog.du-pless.is/jev-and-the-art-of-truth-maintenance):
  the thinking behind the project.

Apache-2.0 licensed.
