import type { GroundAtom } from "@factbag/core/dsl";
import type { KnowledgeBase, Literal } from "@factbag/core/kb";
import type { Chunk } from "@factbag/corpus";
import type { Client, ClassifierClient } from "./client";
import type { EvidenceChoice, SupportedPredicate, Tool, ToolResult } from "./types";

/** Thresholds for admitting signed evidence; an application policy, not a calibration guarantee. */
export type AdmissionPolicy = {
  readonly minimumProbability: number;
  readonly ambiguityMargin: number;
};

/** Copy and validate a policy, defaulting to minimumProbability: 0.4 and ambiguityMargin: 0. */
export function admissionPolicy(
  policy: AdmissionPolicy = { minimumProbability: 0.4, ambiguityMargin: 0 },
): AdmissionPolicy {
  const { minimumProbability, ambiguityMargin } = policy;
  if (!Number.isFinite(minimumProbability) || minimumProbability <= 0 || minimumProbability > 1) {
    throw new Error("minimumProbability must be in (0, 1]");
  }
  if (!Number.isFinite(ambiguityMargin) || ambiguityMargin < 0 || ambiguityMargin > 1) {
    throw new Error("ambiguityMargin must be in [0, 1]");
  }
  return { minimumProbability, ambiguityMargin };
}

/** Client and admission settings supplied by the consumer. Model, timeout and retry settings belong to the client. */
export type RequestConfig = {
  /** Defaults to `new TypeSafeClient()`, configured from `TYPESAFE_*` environment variables. */
  readonly client?: ClassifierClient;
  /** Defaults to minimumProbability: 0.4 and ambiguityMargin: 0. */
  readonly admission?: AdmissionPolicy;
};

/** Completed request with every candidate assessment and its admitted evidence. */
export type Assessment = {
  readonly source: string;
  readonly predicate: SupportedPredicate;
  readonly assessments: readonly {
    readonly optionId: string;
    readonly atom: GroundAtom;
    readonly answer: EvidenceChoice;
    readonly literals: readonly Literal[];
  }[];
};

/** Unevaluated remote work that the consumer may execute independently. */
export type ClassificationJob = {
  readonly source: string;
  readonly predicate: SupportedPredicate;
  /** Each call makes a fresh attempt. Errors propagate; successful repeats add fresh evidence. */
  readonly execute: () => Promise<Assessment>;
};

type JobContext = {
  readonly client: Client;
  readonly output: KnowledgeBase;
  readonly admission: AdmissionPolicy;
};

/** Prepare one request lazily. Nothing remote happens until execute() is called. */
export function createJob(chunk: Chunk, tool: Tool, context: JobContext): ClassificationJob {
  return {
    source: chunk.id,
    predicate: tool.predicate,
    async execute() {
      const result = await context.client.answer(tool, chunk);
      return ingest(result, context.output, context.admission);
    },
  };
}

/** Write admitted, permitted outcomes to the KB and report what was written. */
function ingest(
  { tool, source, answers }: ToolResult,
  kb: KnowledgeBase,
  admission: AdmissionPolicy,
): Assessment {
  const assessments = answers.map(({ candidate, answer }) => {
    const literals: Literal[] = [];
    for (const outcome of admittedOutcomes(answer, admission)) {
      const action = outcome === "ASSERT" ? "assert" : "deny";
      // The caller's grants are enforced here: unpermitted outcomes are skipped, not written.
      if (!tool.actions.has(action)) {
        continue;
      }
      const metadata = {
        source,
        scores: { probability: answer.probabilities[outcome] },
        annotations: {
          jev: {
            optionId: candidate.id,
            outcome,
            choice: answer.choice,
            confidence: answer.confidence,
            probabilities: { ...answer.probabilities },
          },
        },
      };
      literals.push(
        action === "assert"
          ? kb.asserts(candidate.atom, metadata)
          : kb.denies(candidate.atom, metadata),
      );
    }
    return { optionId: candidate.id, atom: candidate.atom, answer, literals };
  });
  return { source, predicate: tool.predicate, assessments };
}

function admittedOutcomes(
  answer: EvidenceChoice,
  policy: AdmissionPolicy,
): readonly ("ASSERT" | "DENY")[] {
  const probabilities = answer.probabilities;
  const strongest = Math.max(probabilities.ASSERT, probabilities.DENY);
  if (probabilities.IRRELEVANT >= strongest) {
    return [];
  }
  const outcomes = ["ASSERT", "DENY"] as const;
  return outcomes.filter(
    (outcome) =>
      probabilities[outcome] >= policy.minimumProbability &&
      strongest - probabilities[outcome] <= policy.ambiguityMargin,
  );
}
