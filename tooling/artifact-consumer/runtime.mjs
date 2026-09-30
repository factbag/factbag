import { predicate } from "@factbag/core/dsl";
import { explainJudgment } from "@factbag/core/explain";
import { KnowledgeBase } from "@factbag/core/kb";
import { query } from "@factbag/core/query";
import { Corpus, chunkers } from "@factbag/corpus";
import { guard } from "@factbag/guards";
import { classifier } from "@factbag/jev/classifier";
import { UnsupportedPredicateError } from "@factbag/jev/errors";
import { resolver } from "@factbag/jev/resolve";

/** @param {unknown} condition @param {string} message */
function invariant(condition, message) {
  if (condition !== true) {
    throw new Error(message);
  }
}

const fact = predicate(
  "artifact_smoke",
  { value: Boolean },
  { description: "Artifact smoke test." },
);
const atom = fact({ value: true });
const kb = new KnowledgeBase();
kb.asserts(atom);

const judgment = query(kb, atom);
invariant(judgment.value === "true", "Core query did not return true");
invariant(
  explainJudgment(judgment).claim.includes("artifact_smoke"),
  "Core explanation omitted the predicate",
);

const corpus = new Corpus();
const document = corpus.add({
  documentId: "artifact-smoke",
  text: "Factbag package artifact.",
});
const chunks = [...corpus.chunk(document, chunkers.recursive({ size: 8 }))];
invariant(chunks.length > 1, "Corpus did not split the document");
invariant(
  chunks.map((chunk) => chunk.text).join("") === document.text,
  "Corpus chunks did not preserve the document text",
);

const guarded = guard(kb).permit("*", fact);
invariant(guarded.query(atom).value === "true", "Guarded query did not return true");

const jobs = classifier(corpus, guarded);
invariant(typeof jobs[Symbol.iterator] === "function", "Jev classifier did not return jobs");
invariant(typeof resolver === "function", "Jev resolver export is not callable");
invariant(typeof UnsupportedPredicateError === "function", "Jev error export is not constructable");
