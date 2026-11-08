import type { Judgement, Model, Outcome, Verdict } from "../types/model";
import type { Question, SystemOneRequest, Transport } from "../provider";
import { assert, isProbability, isRecord } from "../utils";
import {
  adjudicationQuestion,
  adjudicationState,
  classificationQuestion,
  classificationState,
  relevanceQuestion,
  relevanceState,
} from "./prompts";

/**
 * System One models report probabilities rounded to two decimals, so a distribution can miss
 * 1 by a hundredth per value. Tolerate that drift rather than discarding a request's answers.
 */
const ROUNDING_TOLERANCE = 0.011;

const OUTCOMES: readonly Outcome[] = ["ASSERT", "DENY", "IRRELEVANT"];
const VERDICTS: readonly Verdict[] = ["KEEP", "RETRACT"];

/** How to reach one System One model, and how many questions each request holds. */
type Endpoint = {
  readonly name: string;
  /** Questions per request for work that can be split. */
  readonly batchSize: number;
  /** The provider's hard limit, which work that cannot be split must also respect. */
  readonly maxBatchSize: number;
  /** Called per request, so a lazily built transport is only built once something is asked. */
  readonly transport: () => Transport;
};

/**
 * A System One model behind the model interface. Relevance and classification questions are
 * split into `batchSize` batches sent concurrently; adjudication sends every passage in one
 * request, since each is judged with the others in view, and so is bounded by `maxBatchSize`.
 */
export function systemOneModel(endpoint: Endpoint): Model {
  const { name, batchSize } = endpoint;
  return {
    name,
    relevance: async ({ text, subjects }) =>
      await inBatches(
        subjects,
        batchSize,
        async (group) =>
          await ask({
            endpoint,
            prefix: "routing",
            items: group,
            state: () => relevanceState(text),
            question: relevanceQuestion,
            answer: (response, subject) => ({ subject, relevance: noul(response, name) }),
          }),
      ),
    classify: async ({ text, predicate, candidates }) =>
      await inBatches(
        candidates,
        batchSize,
        async (group) =>
          await ask({
            endpoint,
            prefix: "candidate",
            items: group,
            state: (keyed) => classificationState(text, keyed),
            question: (_, index) => classificationQuestion(predicate, index),
            answer: (response, candidate, id) => ({
              candidate,
              judgement: choice(response, OUTCOMES, id, name),
            }),
          }),
      ),
    adjudicate: async ({ atom, passages }) =>
      passages.length === 0
        ? []
        : await ask({
            endpoint,
            prefix: "passage",
            items: passages,
            state: () => adjudicationState(passages, atom),
            question: (_, index) => adjudicationQuestion(atom, index),
            answer: (response, passage, id) => ({
              passage,
              judgement: choice(response, VERDICTS, id, name),
            }),
          }),
  };
}

/** Ask about `size`-item slices concurrently, keeping input order across slices. */
async function inBatches<Item, Result>(
  items: readonly Item[],
  size: number,
  request: (group: readonly Item[]) => Promise<readonly Result[]>,
): Promise<readonly Result[]> {
  const slices = Array.from({ length: Math.ceil(items.length / size) }, (_, slice) =>
    items.slice(slice * size, (slice + 1) * size),
  );
  return (await Promise.all(slices.map(request))).flat();
}

/**
 * Ask one question per item in a single request and turn each answer into a result.
 * Question keys are positional, so they are minted and matched only here. Validation
 * happens while building results, so one bad answer rejects the whole request.
 * Every request holds at least one question: callers send nothing when there is nothing
 * to ask, so an empty request is a bug. More than the provider allows sends nothing and
 * throws.
 */
async function ask<Item, Result>({
  endpoint: { name, maxBatchSize, transport },
  prefix,
  items,
  state,
  question,
  answer,
}: {
  endpoint: Endpoint;
  prefix: string;
  items: readonly Item[];
  state: (keyed: readonly { id: string; item: Item }[]) => SystemOneRequest["state"];
  question: (item: Item, index: number) => Question;
  answer: (response: unknown, item: Item, id: string) => Result;
}): Promise<readonly Result[]> {
  assert(items.length > 0, `Asked ${name} an empty ${prefix} request`);
  if (items.length > maxBatchSize) {
    throw new RangeError(
      `Cannot ask ${items.length} ${prefix} questions in one request: ${name} accepts at most ${maxBatchSize}`,
    );
  }
  const keyed = items.map((item, index) => ({ id: `${prefix}_${index}`, item }));
  const { answers } = await transport()({
    state: state(keyed),
    questions: Object.fromEntries(keyed.map(({ id, item }, index) => [id, question(item, index)])),
  });
  const keyedAnswers = isRecord(answers) ? answers : {};
  return keyed.map(({ id, item }) => answer(keyedAnswers[id], item, id));
}

/** A validated relevance probability. */
function noul(response: unknown, name: string): number {
  if (!isRecord(response) || response["type"] !== "noul" || !isProbability(response["noul"])) {
    throw new Error(`Invalid or missing routing answer from ${name}`);
  }
  return response["noul"];
}

/** A validated choice, keeping the model's own choice and confidence as provenance detail. */
function choice<Label extends string>(
  response: unknown,
  labels: readonly Label[],
  id: string,
  name: string,
): Judgement<Label> {
  if (!isChoice(response, labels)) {
    throw new Error(`Invalid choice answer from ${name}`);
  }
  return {
    probabilities: response.probabilities,
    details: {
      optionId: id,
      choice: response.choice,
      confidence: response.confidence,
      probabilities: { ...response.probabilities },
    },
  };
}

type ChoiceAnswer<Label extends string> = {
  readonly type: "choice";
  readonly choice: Label;
  readonly confidence: number;
  readonly probabilities: Readonly<Record<Label, number>>;
};

/**
 * A Choice answer to the labels it was asked with: every label has a probability, they sum
 * to 1 within rounding, and the selected label is one of them.
 */
function isChoice<Label extends string>(
  value: unknown,
  labels: readonly Label[],
): value is ChoiceAnswer<Label> {
  if (!isRecord(value) || value["type"] !== "choice" || !isRecord(value["probabilities"])) {
    return false;
  }
  const distribution = value["probabilities"];
  const probabilities = labels.map((label) => distribution[label]);
  if (!probabilities.every(isProbability)) {
    return false;
  }
  const total = probabilities.reduce((sum, probability) => sum + probability, 0);
  return (
    isProbability(value["confidence"]) &&
    labels.some((label) => label === value["choice"]) &&
    Math.abs(total - 1) <= labels.length * ROUNDING_TOLERANCE
  );
}
