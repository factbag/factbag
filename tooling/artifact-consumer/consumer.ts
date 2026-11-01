import { TypeSafeClient } from "@typesafe-ai/sdk";
import { predicate } from "factbag/dsl";
import { explainJudgment, type Explanation } from "factbag/explain";
import { KnowledgeBase } from "factbag/kb";
import { query, type Judgment } from "factbag/query";
import { Corpus, chunkers } from "factbag/corpus";
import { guard } from "factbag/guards";
import { classifier } from "factbag/jev/classifier";
import { UnsupportedPredicateError } from "factbag/jev/errors";
import { resolver } from "factbag/jev/resolve";
import { createConfig, type Config } from "factbag/jev/config";

const fact = predicate(
  "artifact_smoke",
  { value: Boolean },
  { description: "Artifact smoke test." },
);
const kb = new KnowledgeBase();
const corpus = new Corpus();
const guarded = guard(kb).permit("*", fact);
const atom = fact({ value: true });
kb.asserts(atom);
const judgment = query(kb, atom);
const explanation = explainJudgment(judgment);
const document = corpus.add({ documentId: "artifact-smoke", text: "Factbag package artifact." });
const chunks = corpus.chunk(document, chunkers.recursive({ size: 8 }));

const client = new TypeSafeClient({ apiKey: "typecheck-only" });
const options: Config = { client, minimumProbability: 0.6, ambiguityMargin: 0 };
const config = createConfig(options);
const classifications = classifier({ corpus, input: guarded, config });
const resolutions = resolver(corpus, kb, config);
// Both workflows expose the same opaque job contract.
for (const run of [classifications, resolutions]) {
  for (const job of run) {
    const pending: Promise<void> = job.execute();
    void pending;
  }
  const output: KnowledgeBase = run.kb;
  void output;
}
void UnsupportedPredicateError;
void explanation;
void chunks;
const publicTypes: [Judgment?, Explanation?] = [];
void publicTypes;
