import { predicate } from "factbag/dsl";
import { explainJudgment, type Explanation } from "factbag/explain";
import { KnowledgeBase } from "factbag/kb";
import { query, type Judgment } from "factbag/query";
import { Corpus, chunkers } from "factbag/corpus";
import { guard } from "factbag/guards";
import {
  classifier,
  type AdmissionPolicy,
  type Assessment,
  type ClassificationJob,
  type ClassificationRun,
  type ClassifierClient,
  type ClassificationQuestions,
  type EvidenceChoice,
  type Outcome,
  type RequestConfig,
  type SupportedField,
  type SupportedPredicate,
} from "factbag/jev/classifier";
import { UnsupportedPredicateError } from "factbag/jev/errors";
import {
  resolver,
  type AdmissionPolicy as ResolutionAdmissionPolicy,
  type AdjudicationQuestions,
  type AdjudicatorClient,
  type Judgment as ResolutionJudgment,
  type Resolution,
  type ResolutionConfig,
  type ResolutionJob,
  type ResolutionRun,
  type Standing,
  type StandingChoice,
} from "factbag/jev/resolve";

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

const policy: AdmissionPolicy = {
  minimumProbability: 0.6,
  ambiguityMargin: 0,
};
const client: ClassifierClient & AdjudicatorClient = {
  systemOne: async () => await Promise.reject(new Error("Typecheck only")),
};
const config: RequestConfig = { client, admission: policy };
const resolutionPolicy: ResolutionAdmissionPolicy = policy;
const resolveConfig: ResolutionConfig = { client, admission: resolutionPolicy };
const classifications: ClassificationRun = classifier(corpus, guarded, config);
const resolutions: ResolutionRun = resolver(corpus, kb, resolveConfig);
for (const job of classifications) {
  const typedJob: ClassificationJob = job;
  const result: Promise<Assessment> = typedJob.execute();
  void result;
}
for (const job of resolutions) {
  const typedJob: ResolutionJob = job;
  const result: Promise<Resolution> = typedJob.execute();
  void result;
}
void UnsupportedPredicateError;
void explanation;
void chunks;
const publicTypes: [
  Judgment?,
  Explanation?,
  ResolutionJudgment?,
  EvidenceChoice?,
  Outcome?,
  SupportedField?,
  SupportedPredicate?,
  ClassificationQuestions?,
  AdjudicationQuestions?,
  Standing?,
  StandingChoice?,
] = [];
void publicTypes;
