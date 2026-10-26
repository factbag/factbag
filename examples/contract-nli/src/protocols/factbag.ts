/**
 * The same task through Factbag: each hypothesis becomes a predicate Jev may assert or
 * deny from the contract's passages, and the label follows from querying the result.
 * Everything that varies between configurations is injected through `FactbagSetup`.
 */
import { predicate } from "@factbag/core/dsl";
import type { GroundAtom, PredicateDeclaration } from "@factbag/core/dsl";
import { KnowledgeBase } from "@factbag/core/kb";
import { query } from "@factbag/core/query";
import { Corpus } from "@factbag/corpus";
import { guard } from "@factbag/guards";
import { classifier } from "@factbag/jev/classifier";
import type { AdmissionPolicy, Assessment } from "@factbag/jev/classifier";
import { pool } from "@factbag/eval-shared/pool";
import type { Hypothesis, Label } from "../data";
import { metered } from "./types";
import type { Client, ContractResult, Meter, Protocol } from "./types";

/** A hypothesis-level predicate: the atom whose query value becomes the label. */
export type Target = Readonly<{
  hypothesisId: string;
  atom: GroundAtom;
  /** When the atom is not settled, this atom being true means Contradiction. */
  contra?: GroundAtom;
}>;

export type FactbagSetup = Readonly<{
  name: string;
  /**
   * Declare the KB for one contract: the predicates Jev may assess (returned as writable),
   * any rules, and the target atom per hypothesis. Called once per contract so KBs are fresh.
   */
  build: (
    hypotheses: readonly Hypothesis[],
    kb: KnowledgeBase,
  ) => Readonly<{
    writable: readonly PredicateDeclaration[];
    targets: readonly Target[];
  }>;
  admission?: AdmissionPolicy;
  /** In-flight requests per contract. */
  concurrency?: number;
}>;

/** The naive configuration: one predicate per hypothesis, described by the hypothesis itself. */
export const naive: FactbagSetup = {
  name: "naive",
  build(hypotheses) {
    const writable: PredicateDeclaration[] = [];
    const targets = hypotheses.map((hypothesis): Target => {
      const declaration = predicate(
        hypothesis.id.replace("-", "_"),
        {},
        { description: hypothesis.text },
      );
      writable.push(declaration);
      return { hypothesisId: hypothesis.id, atom: declaration({}) };
    });
    return { writable, targets };
  },
};

type Observation = Readonly<{
  source: string;
  choice: string;
  probabilities: Readonly<Record<"ASSERT" | "DENY" | "IRRELEVANT", number>>;
}>;

export function factbagProtocol(sdk: Client, setup: FactbagSetup): Protocol {
  return {
    name: setup.name,
    async run(contract, hypotheses): Promise<ContractResult> {
      const meter: Meter = { requests: 0, inputTokens: 0, outputTokens: 0 };
      const client = metered(sdk, meter);
      const kb = new KnowledgeBase();
      const { writable, targets } = setup.build(hypotheses, kb);
      let access = guard(kb);
      for (const declaration of writable) {
        access = access.permit("assert", declaration).permit("deny", declaration);
      }
      const corpus = new Corpus();
      corpus.add({ documentId: `contract-${contract.id}`, text: contract.text });
      const config =
        setup.admission === undefined ? { client } : { client, admission: setup.admission };
      const run = classifier(corpus, access, config);
      const jobs = [...run];
      const assessments: Assessment[] = [];
      const started = performance.now();
      await pool(jobs, setup.concurrency ?? 4, async (job) => {
        assessments.push(await job.execute());
      });
      const latencyMs = performance.now() - started;

      // Every chunk's answer about every predicate, for conflict resolution and analysis.
      const observations = new Map<string, Observation[]>();
      for (const { source, predicate: declaration, assessments: answers } of assessments) {
        for (const { answer } of answers) {
          const list = observations.get(declaration.name) ?? [];
          list.push({ source, choice: answer.choice, probabilities: answer.probabilities });
          observations.set(declaration.name, list);
        }
      }

      const labels: Record<string, Label> = {};
      const values: Record<string, string> = {};
      for (const target of targets) {
        let value: string = query(run.kb, target.atom).value;
        if (value === "unknown" && target.contra !== undefined) {
          value = query(run.kb, target.contra).value === "true" ? "false" : "unknown";
        }
        values[target.hypothesisId] = value;
        labels[target.hypothesisId] = toLabel(
          value,
          observations.get(target.atom.predicate.name) ?? [],
        );
      }
      return {
        contractId: contract.id,
        labels,
        requests: meter.requests,
        inputTokens: meter.inputTokens,
        latencyMs,
        detail: { values, observations: Object.fromEntries(observations) },
      };
    },
  };
}

/** Conflicted targets go to whichever sign any passage supported most strongly. */
function toLabel(value: string, observations: readonly Observation[]): Label {
  switch (value) {
    case "true":
      return "Entailment";
    case "false":
      return "Contradiction";
    case "unknown":
      return "NotMentioned";
    default: {
      let assert = 0;
      let deny = 0;
      for (const { probabilities } of observations) {
        assert = Math.max(assert, probabilities.ASSERT);
        deny = Math.max(deny, probabilities.DENY);
      }
      return deny > assert ? "Contradiction" : "Entailment";
    }
  }
}
