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

Suppose a company can enter your review queue once a registry document establishes
that it is legally active. Jev reads the document; your rule determines what that
evidence means for the queue.

```ts
import { enumeration, predicate, variable } from "factbag/dsl";
import { KnowledgeBase } from "factbag/kb";
import { query } from "factbag/query";
import { Corpus } from "factbag/corpus";
import { guard } from "factbag/guards";
import { classifier } from "factbag/jev/classifier";

const company = enumeration("Harbor");
const active = predicate(
  "company_active",
  { company },
  {
    description: "The document establishes that this company is legally active.",
  },
);
const readyForReview = predicate("ready_for_review", { company });
const candidate = variable("company");
const kb = new KnowledgeBase();
kb.rule(readyForReview({ company: candidate })).if(active({ company: candidate }));

const corpus = new Corpus();
corpus.add({ documentId: "registry", text: "Harbor is an active company." });

// Only this predicate may receive positive or negative evidence from Jev.
const run = classifier(corpus, guard(kb).permit("assert", active).permit("deny", active));

for (const job of run) {
  const result = await job.execute(); // Makes a live Jev request.
  console.log(result.assessments);
}

console.log(query(run.kb, readyForReview({ company: "Harbor" })).value);
// "true" if Jev's supporting assessment meets the admission policy.
// kb is unchanged; run.kb contains the new evidence.
```

Candidate values must be finite: use enumerations, booleans, or registered
entities rather than open-ended strings. Only `job.execute()` calls Jev; your
application controls pacing. Results can be `true`, `false`, `conflicted`, or
`unknown`, depending on the evidence admitted.

## Go further

- [Introducing Factbag](https://blog.du-pless.is/introducing-factbag): how and why
  to use it.
- [Jev and the Art of Truth Maintenance](https://blog.du-pless.is/jev-and-the-art-of-truth-maintenance):
  the thinking behind the project.

Apache-2.0 licensed.
