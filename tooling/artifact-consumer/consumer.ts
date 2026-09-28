import { predicate } from "@factbag/core/dsl";
import type { Explanation } from "@factbag/core/explain";
import { KnowledgeBase } from "@factbag/core/kb";
import type { Judgment } from "@factbag/core/query";
import { Corpus } from "@factbag/corpus";
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

void classifier(corpus, guarded);
void resolver;
void UnsupportedPredicateError;
const publicTypes: [Judgment?, Explanation?] = [];
void publicTypes;
