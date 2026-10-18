import { predicate } from "factbag/dsl";
import { explainJudgment } from "factbag/explain";
import { KnowledgeBase } from "factbag/kb";
import { query } from "factbag/query";
import { Corpus, chunkers } from "factbag/corpus";
import { guard } from "factbag/guards";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
for (const name of [
  "react",
  "react-dom",
  "@factbag/core",
  "@factbag/corpus",
  "@factbag/guards",
  "@factbag/jev",
]) {
  assert.throws(() => require.resolve(name), { code: "MODULE_NOT_FOUND" });
}
assert.throws(() => require.resolve("factbag/widgets"), { code: "ERR_PACKAGE_PATH_NOT_EXPORTED" });

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

export { invariant, atom, kb, corpus, document, guarded };
