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

Suppose we're checking whether an investor qualifies through the individual-income
route: income above $200,000 in each of the previous two years, with a reasonable
expectation of the same income level this year. This example models that one route
from the accredited-investor example in the blog.

Our structured records establish past income. Jev reads the investor's statement
about this year's expectations; an explicit rule combines the evidence.

The snippets below build on each other in one TypeScript file.

### 1. Define the claims

Declare the facts we'll combine, and describe the claim Jev will assess.

```ts
import { and, enumeration, predicate, variable } from "factbag/dsl";
import { KnowledgeBase } from "factbag/kb";
import { query } from "factbag/query";
import { Corpus } from "factbag/corpus";
import { guard } from "factbag/guards";
import { classifier } from "factbag/jev/classifier";

const person = enumeration("Alice");
const incomeOver200k = predicate("income_over_200k", {
  person,
  year: Number,
});
const expectsSameIncome = predicate(
  "expects_same_income",
  { person },
  {
    description:
      "The person reasonably expects their individual income in 2026 to remain " +
      "at least at the level earned in each of 2024 and 2025.",
  },
);
const qualifiedInvestor = predicate("qualified_investor", { person });
```

For predicates exposed to Jev, candidate values must be finite: use enumerations,
booleans, or registered entities rather than open-ended strings or numbers.
Here, Jev will only assess `expectsSameIncome` for Alice.

### 2. Write the qualification rule

All three conditions must hold for this route to qualification.

```ts
const investor = variable("investor");
const kb = new KnowledgeBase();
kb.rule(qualifiedInvestor({ person: investor })).if(
  and(
    incomeOver200k({ person: investor, year: 2024 }),
    incomeOver200k({ person: investor, year: 2025 }),
    expectsSameIncome({ person: investor }),
  ),
);
```

### 3. Add the known facts and the document

Our application has already checked the amounts in structured income records.
The statement about future income goes into the corpus for Jev to read.

```ts
kb.asserts(incomeOver200k({ person: "Alice", year: 2024 }), { source: "tax-record-2024" });
kb.asserts(incomeOver200k({ person: "Alice", year: 2025 }), { source: "tax-record-2025" });

const corpus = new Corpus();
corpus.add({
  documentId: "alice-income-statement",
  text:
    "I, Alice, earned $250,000 in both 2024 and 2025. My employment contract " +
    "continues through 2026 at the same salary, so I expect the same income this year.",
});
```

### 4. Ask Jev to assess the statement

Permit Jev to assert or deny the expected-income claim. Only `job.execute()`
makes a live request; the loop controls pacing.

```ts
const run = classifier(
  corpus,
  guard(kb).permit("assert", expectsSameIncome).permit("deny", expectsSameIncome),
);

for (const job of run) {
  const result = await job.execute(); // Makes a live Jev request.
  console.log(result.assessments);
}
```

### 5. Query the conclusion

The output knowledge base combines the original facts and rule with the admitted
evidence. The input `kb` is unchanged.

```ts
console.log(query(run.kb, qualifiedInvestor({ person: "Alice" })).value);
// "true" if Jev's supporting assessment meets the admission policy.
```

Results can be `true`, `false`, `conflicted`, or
`unknown`, depending on the evidence admitted.

## Go further

- [Introducing Factbag](https://blog.du-pless.is/introducing-factbag): how and why
  to use it.
- [Jev and the Art of Truth Maintenance](https://blog.du-pless.is/jev-and-the-art-of-truth-maintenance):
  the thinking behind the project.

Apache-2.0 licensed.
