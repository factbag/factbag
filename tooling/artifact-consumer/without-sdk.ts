import { predicate, query, type Judgment } from "factbag/dsl";
import { UnsupportedPredicateError } from "factbag/exceptions";
import { KnowledgeBase, guard } from "factbag/kb";
import { explainJudgment, type Explanation } from "factbag/explain";
import { Corpus } from "factbag/corpus";
import { classifier, type Config, createConfig, resolver } from "@factbag/clef";
import {
  toolkit,
  type OpenAITool,
  type OpenAIToolAnswer,
  type OpenAIToolMessage,
  type ToolOutcome,
  type Toolkit,
  type ToolkitOptions,
} from "@factbag/openai";

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

const options: Config = { model: "clef", accountId: "account", apiToken: "token", batchSize: 32 };
const config = createConfig(options);
const runs = [classifier({ corpus, input: guarded, config }), resolver(corpus, kb, config)];
void runs;
void UnsupportedPredicateError;

const toolkitOptions: ToolkitOptions = { requireJustification: false };
const kit: Toolkit = toolkit(guarded, toolkitOptions);
const tools: readonly OpenAITool[] = kit.tools();
const answer: OpenAIToolAnswer = kit.answer({
  id: "call",
  function: {
    name: "knowledge_base",
    arguments: '{"operation":"assert","name":"without_sdk","arguments":"{\\"value\\":true}"}',
  },
});
const reply: OpenAIToolMessage = answer.message;
const outcome: ToolOutcome | undefined = answer.outcome;
void tools;
void reply;
void outcome;
