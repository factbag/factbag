import { predicate } from "factbag/dsl";
import { KnowledgeBase } from "factbag/kb";
import { query, type Judgment } from "factbag/query";
import { explainJudgment, type Explanation } from "factbag/explain";
import { Corpus } from "factbag/corpus";
import { guard } from "factbag/guards";

const fact = predicate("without_sdk", { value: Boolean });
const atom = fact({ value: true });
const kb = new KnowledgeBase();
kb.asserts(atom);
const guarded = guard(kb).permit("*", fact);
const judgment: Judgment = query(kb, atom);
const guardedJudgment: Judgment = guarded.query(atom);
void guardedJudgment;
const explanation: Explanation = explainJudgment(judgment);
const corpus = new Corpus();
corpus.add({ documentId: "without-sdk", text: explanation.claim });
