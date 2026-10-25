# Factbag

[![npm alpha](https://img.shields.io/npm/v/factbag/alpha)](https://www.npmjs.com/package/factbag)
[![CI](https://img.shields.io/github/actions/workflow/status/factbag/factbag/ci.yml?branch=main&event=push&label=CI)](https://github.com/factbag/factbag/actions/workflows/ci.yml?query=branch%3Amain)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue)](https://github.com/factbag/factbag/blob/main/LICENSE)

<img src="https://raw.githubusercontent.com/factbag/factbag/main/docs/assets/factbag.png" alt="An open canvas bag" align="right" width="180" />

Turn documents into evidence and conclusions with [Jev](https://typesafe.ai/) and TypeScript.

Factbag uses TypeSafe AI’s Jev model to read passages and assess specific claims.
Those assessments become evidence in a knowledge base, alongside facts from your
application. You write the rules that connect them and query what follows.

Each piece of documentary evidence points back to its source passage. Conclusions
can be **true**, **false**, **conflicted**, or **unknown**. When documents disagree,
you can inspect the conflicting evidence, correct a particular fact, and query
the rules again.

> **Important:** Factbag is an early alpha release and still pretty rough - APIs will definitely change.

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
npm install factbag@alpha @typesafe-ai/sdk@^0.6.0
```

ESM only. Requires Node 22.18+ on the 22.x line, or Node 24 or 26.

Set your TypeSafe API key in the environment:

```sh
export TYPESAFE_API_KEY="your-api-key"
```

## From a document to a conclusion

### 1. Decide on your ruleset

Start with the criteria your application needs to apply. These might be your own
business rules or requirements set out in legislation or regulations.

Here, we're translating the individual-income route in the SEC's
[accredited-investor definition, 17 CFR § 230.501(a)(6)](<https://www.ecfr.gov/current/title-17/chapter-II/part-230/section-230.501#p-230.501(a)(6)>),
into three conditions:

- Individual income exceeded $200,000 in the first of the two most recent years.
- Individual income exceeded $200,000 in the second year.
- The person reasonably expects to reach the same income level in the current year.

### 2. Define the claims

Declare the facts we'll combine, and describe the claims Jev will assess.

```ts
import { and, enumeration, predicate, variable } from "factbag/dsl";
import { KnowledgeBase } from "factbag/kb";
import { query } from "factbag/query";
import { Corpus } from "factbag/corpus";
import { guard } from "factbag/guards";
import { classifier } from "factbag/jev/classifier";

class Person {
  constructor(
    readonly id: string,
    readonly name: string,
  ) {}
}

const hasIncomeOver200k = predicate(
  "has_income_over_200k",
  { person: Person, year: enumeration("2024", "2025") },
  {
    description:
      "The person's total individual annual income exceeded USD 200,000 in the " +
      "specified year. Joint household income and forecasts do not count.",
  },
);

const expectsSameIncome = predicate(
  "expects_same_income",
  { person: Person },
  {
    description:
      "The person reasonably expects their individual income in 2026 to remain " +
      "at least at the level earned in each of 2024 and 2025.",
  },
);

const isQualifiedInvestor = predicate("is_qualified_investor", {
  person: Person,
});
const hasVerifiedIdentity = predicate("has_verified_identity", {
  person: Person,
});
const isReadyForReview = predicate("is_ready_for_review", { person: Person });
```

### 3. Encode the ruleset

All three income conditions must hold for this route to qualification. Our
application also requires verified identity before sending an investor for review.

```ts
const person = variable("person");
const kb = new KnowledgeBase();

kb.rule(isQualifiedInvestor({ person })).if(
  and(
    hasIncomeOver200k({ person, year: "2024" }),
    hasIncomeOver200k({ person, year: "2025" }),
    expectsSameIncome({ person }),
  ),
);

kb.rule(isReadyForReview({ person })).if(
  and(isQualifiedInvestor({ person }), hasVerifiedIdentity({ person })),
);
```

### 4. Import a known fact and add documents

Identity verification comes directly from our onboarding system. Income evidence
goes into the corpus for Jev to assess.

```ts
const alice = new Person("alice", "Alice");
kb.entities.add(alice);

kb.asserts(hasVerifiedIdentity({ person: alice }), {
  source: "onboarding:alice",
});

const corpus = new Corpus();

// Tax returns provide evidence of past annual income.
corpus.add({ documentId: "alice-2024-federal-tax-return", text: "…" });
corpus.add({ documentId: "alice-2025-federal-tax-return", text: "…" });

// An employer letter supports the expectation of continued income.
corpus.add({
  documentId: "alice-2026-employment-confirmation-letter",
  text: "…",
});
```

### 5. Set Jev's permissions

The guard starts with no permissions. Permit Jev to assert or deny the two income
predicates.

```ts
const incomeEvidence = guard(kb)
  .permit("assert", hasIncomeOver200k)
  .permit("deny", hasIncomeOver200k)
  .permit("assert", expectsSameIncome)
  .permit("deny", expectsSameIncome);
```

### 6. Ask Jev to assess the income evidence

```ts
const run = classifier(corpus, incomeEvidence);

for (const job of run) {
  await job.execute(); // Makes a live Jev request.
}
```

### 7. Query the conclusion

The output knowledge base combines the imported fact and rules with the admitted
evidence.

```ts
const qualification = query(run.kb, isQualifiedInvestor({ person: alice }));
const reviewReadiness = query(run.kb, isReadyForReview({ person: alice }));

// Both are "true" if Jev admits supporting evidence for all three income claims.
qualification.value; // "true"
reviewReadiness.value; // "true"
```

Results can be `true`, `false`, `conflicted`, or
`unknown`, depending on the evidence admitted.

### 8. Inspect the proof tree

Use `explainJudgment()` to follow a conclusion through its rule to the supporting
evidence and source passages.

```ts
import { explainJudgment } from "factbag/explain";

const proof = explainJudgment(qualification);
JSON.stringify(proof, null, 2); // JSON shown below.
```

An abbreviated example with supporting evidence for all three claims:

```json
{
  "claim": "is_qualified_investor(alice) = true",
  "because": "is_qualified_investor(person) if and(...), with person = alice",
  "given": [
    {
      "claim": "and(...) = true",
      "given": [
        {
          "claim": "has_income_over_200k(alice, 2024) = true",
          "because": {
            "claim": "has_income_over_200k(alice, 2024) = true",
            "source": "alice-2024-federal-tax-return#0-1"
          }
        },
        {
          "claim": "has_income_over_200k(alice, 2025) = true",
          "because": {
            "claim": "has_income_over_200k(alice, 2025) = true",
            "source": "alice-2025-federal-tax-return#0-1"
          }
        },
        {
          "claim": "expects_same_income(alice) = true",
          "because": {
            "claim": "expects_same_income(alice) = true",
            "source": "alice-2026-employment-confirmation-letter#0-1"
          }
        }
      ]
    }
  ]
}
```

Source IDs identify document passages; their ranges depend on the document text.
Use `corpus.resolve(source)` to retrieve the passage behind a piece of evidence.

```ts
const source = "alice-2024-federal-tax-return#0-1";
corpus.resolve(source); // Object shown below.
```

The result includes the exact passage and its containing document:

```json
{
  "chunk": {
    "id": "alice-2024-federal-tax-return#0-1",
    "documentId": "alice-2024-federal-tax-return",
    "range": { "start": 0, "end": 1 },
    "text": "…"
  },
  "document": {
    "documentId": "alice-2024-federal-tax-return",
    "text": "…",
    "metadata": {}
  }
}
```

### 9. Review conflicting evidence (optional)

Suppose an original tax return puts Alice below the income threshold, but an
amended return puts her above it. Jev admits both accounts, leaving qualification
`conflicted`. In this example, the other income conditions have supporting evidence.

You could pass the conflicting evidence to a human for review, or ask Jev to
compare the sources using the `resolver`.

Evidence judged superseded is retracted from the resolver's output
knowledge base.

```ts
import { resolver } from "factbag/jev/resolve";

query(run.kb, isQualifiedInvestor({ person: alice })).value; // "conflicted"

const review = resolver(corpus, run.kb);

for (const job of review) {
  await job.execute();
}

// If the resolver retracts the superseded return's denial:
query(review.kb, isQualifiedInvestor({ person: alice })).value; // "true"
```

## Go further

- [Introducing Factbag](https://daniel.du-pless.is/introducing-factbag): how and why
  to use it.
- [Jev and the Art of Truth Maintenance](https://daniel.du-pless.is/jev-and-the-art-of-truth-maintenance):
  the thinking behind the project.

Apache-2.0 licensed.
