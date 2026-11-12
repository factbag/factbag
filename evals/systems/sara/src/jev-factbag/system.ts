/**
 * Factbag's answer to SARA: ground the case text into a knowledge base holding the statute,
 * read the question as a query atom over it, and let the statute decide. True is
 * Entailment, false Contradiction; anything else, or a question citing a provision the
 * statute does not cover, is no answer.
 */
import { query } from "factbag/dsl";
import type { SaraInput, SaraLabel } from "@factbag/sara-benchmark";
import { USD_PER_CLAIRIC_INPUT_TOKEN, USD_PER_JEV_INPUT_TOKEN } from "../models/prices";
import type { FlagValues, System, SystemDefinition } from "@factbag/eval-runner";
import type { Settings } from "@factbag/jev";
import { ground, groundingSettings } from "./ground";
import { labelOf, renderFields } from "../statute/record";
import type { FactbagDetail } from "../statute/record";
import { MeteredClient } from "./meter";
import { readQuestion } from "./question";
import { provisionFor } from "../statute";
import { EXTRACTION_VERSION } from "../statute/schema";
import { clairicConfig } from "./symbols";

type FactbagOptions = Readonly<{
  /** The Jev model, such as "jev-1.13.0". */
  model: string;
  /** Overrides of Jev's grounding settings: its defaults, with routing on. */
  settings?: Settings;
}>;

/**
 * Needs TYPESAFE_API_KEY for Jev, and CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN for
 * Clairic. Each case gets its own clients, so its usage is its own.
 */
function factbagSystem({
  model,
  settings: overrides,
}: FactbagOptions): System<SaraInput, SaraLabel> {
  const settings = groundingSettings(overrides);
  return {
    name: `jev-factbag-${model}`,
    config: {
      model,
      extraction: EXTRACTION_VERSION,
      extractor: "@factbag/symbol-extractor-clairic",
      jev: settings,
    },
    async solve({ text, question }) {
      const provision = provisionFor(question);
      if (provision === undefined) {
        return { answer: undefined, usage: [] };
      }
      const client = new MeteredClient({ defaultModel: model, timeout: 300_000 });
      const clairicUsage = { requests: 0, inputTokens: 0 };
      const clairic = clairicConfig(clairicUsage);
      const grounding = await ground(text, { client, clairic, settings });
      const reading = await readQuestion(question, provision, grounding.people, {
        client,
        clairic,
      });
      const usage = [
        {
          model,
          requests: client.requests,
          inputTokens: client.inputTokens,
          usd: client.inputTokens * USD_PER_JEV_INPUT_TOKEN,
        },
        {
          model: "clairic",
          ...clairicUsage,
          usd: clairicUsage.inputTokens * USD_PER_CLAIRIC_INPUT_TOKEN,
        },
      ];
      const detail: FactbagDetail = {
        people: grounding.people.map((person) => person.id),
        facts: grounding.literals.map((literal) => ({
          sign: literal.sign,
          predicate: literal.atom.predicate.name,
          fields: renderFields(literal.atom.fields),
        })),
        reading: reading.probability,
      };
      if (reading.atom === undefined) {
        const unread: FactbagDetail = { ...detail, unread: reading.reason ?? "unread" };
        return { answer: undefined, usage, detail: unread };
      }
      const queried = performance.now();
      const { value } = query(grounding.kb, reading.atom);
      const solverMs = performance.now() - queried;
      const solved: FactbagDetail = {
        ...detail,
        atom: { predicate: reading.atom.predicate.name, fields: renderFields(reading.atom.fields) },
        value,
        solverMs,
      };
      return { answer: labelOf(value), usage, detail: solved };
    },
  };
}

/** A numeric flag, when given; Jev rejects one that is out of range or not a number. */
function numeric(name: string, value: string | undefined): Record<string, number> {
  return value === undefined ? {} : { [name]: Number(value) };
}

/**
 * `--system jev-factbag`: `--model`, and Jev's routing settings as `--predicate-threshold`,
 * `--symbol-threshold` and `--candidate-product-cutoff`, which default to Jev's.
 */
export const jevFactbag: SystemDefinition<SaraInput, SaraLabel> = {
  env: ["TYPESAFE_API_KEY", "CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"],
  concurrency: 2,
  flags: {
    model: { type: "string", default: "jev-1.13.0" },
    "predicate-threshold": { type: "string" },
    "symbol-threshold": { type: "string" },
    "candidate-product-cutoff": { type: "string" },
  },
  create: (flags: FlagValues) =>
    factbagSystem({
      model: flags["model"] ?? "",
      settings: {
        ...numeric("predicateThreshold", flags["predicate-threshold"]),
        ...numeric("symbolThreshold", flags["symbol-threshold"]),
        ...numeric("candidateProductCutoff", flags["candidate-product-cutoff"]),
      },
    }),
};
