import { predicate } from "@factbag/core/dsl";
import { explainJudgment, type Explanation } from "@factbag/core/explain";
import { KnowledgeBase } from "@factbag/core/kb";
import { query, type Judgment } from "@factbag/core/query";
import { Corpus, chunkers } from "@factbag/corpus";
import { guard } from "@factbag/guards";
import { classifier } from "@factbag/jev/classifier";
import { UnsupportedPredicateError } from "@factbag/jev/errors";
import { resolver } from "@factbag/jev/resolve";

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

void classifier(corpus, guarded);
void resolver;
void UnsupportedPredicateError;
void explanation;
void chunks;
const publicTypes: [Judgment?, Explanation?] = [];
void publicTypes;
