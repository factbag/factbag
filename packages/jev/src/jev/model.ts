import type { ChoiceResponse, JsonValue, Question, TypeSafeClient } from "@typesafe-ai/sdk";
import type { Judgement, Model, Outcome, Verdict } from "../types/model";
import { isProbability, isRecord } from "../utils";
import {
  adjudicationQuestion,
  adjudicationState,
  classificationQuestion,
  classificationState,
} from "./prompts";

/**
 * How many questions one request may ask. Accuracy holds to roughly a hundred candidates
 * and then falls away: at several hundred the model starts attributing a document's facts
 * to candidates it does not mention. Splitting costs requests, and resends the passage, but
 * keeps each request's questions about a readable shortlist.
 */
const MAX_QUESTIONS_PER_REQUEST = 64;

/**
 * Jev reports probabilities rounded to two decimals, so a distribution can miss 1 by a
 * hundredth per value. Tolerate that drift rather than discarding a whole request's answers.
 */
const ROUNDING_TOLERANCE = 0.011;

const OUTCOMES: readonly Outcome[] = ["ASSERT", "DENY", "IRRELEVANT"];
const VERDICTS: readonly Verdict[] = ["KEEP", "RETRACT"];

type Client = Pick<TypeSafeClient, "systemOne">;

/**
 * Jev behind the model interface. Classification questions are split into request-sized
 * batches sent concurrently; adjudication sends every passage in one request, since each is
 * judged with the others in view. `client` is called per request, so a lazily built client
 * is only constructed once something is asked.
 */
export function jev(client: () => Client): Model {
  return {
    name: "jev",
    classify: async ({ text, predicate, candidates }) =>
      await inBatches(
        candidates,
        async (group) =>
          await ask({
            client,
            prefix: "candidate",
            items: group,
            state: (keyed) => classificationState(text, keyed),
            question: (_, index) => classificationQuestion(predicate, index),
            answer: (response, candidate, id) => ({
              candidate,
              judgement: choice(response, OUTCOMES, id),
            }),
          }),
      ),
    adjudicate: async ({ atom, passages }) =>
      await ask({
        client,
        prefix: "passage",
        items: passages,
        state: () => adjudicationState(passages, atom),
        question: (_, index) => adjudicationQuestion(atom, index),
        answer: (response, passage, id) => ({ passage, judgement: choice(response, VERDICTS, id) }),
      }),
  };
}

/** Ask about request-sized slices concurrently, keeping input order across slices. */
async function inBatches<Item, Result>(
  items: readonly Item[],
  request: (group: readonly Item[]) => Promise<readonly Result[]>,
): Promise<readonly Result[]> {
  const slices = Array.from(
    { length: Math.ceil(items.length / MAX_QUESTIONS_PER_REQUEST) },
    (_, slice) =>
      items.slice(slice * MAX_QUESTIONS_PER_REQUEST, (slice + 1) * MAX_QUESTIONS_PER_REQUEST),
  );
  return (await Promise.all(slices.map(request))).flat();
}

/**
 * Ask one question per item in a single request and turn each answer into a result.
 * Question keys are positional, so they are minted and matched only here. Validation
 * happens while building results, so one bad answer rejects the whole request.
 * Nothing to ask sends nothing.
 */
async function ask<Item, Result>({
  client,
  prefix,
  items,
  state,
  question,
  answer,
}: {
  client: () => Client;
  prefix: string;
  items: readonly Item[];
  state: (keyed: readonly { id: string; item: Item }[]) => Record<string, JsonValue>;
  question: (item: Item, index: number) => Question;
  answer: (response: unknown, item: Item, id: string) => Result;
}): Promise<readonly Result[]> {
  if (items.length === 0) {
    return [];
  }
  const keyed = items.map((item, index) => ({ id: `${prefix}_${index}`, item }));
  const { answers } = await client().systemOne({
    state: state(keyed),
    questions: Object.fromEntries(keyed.map(({ id, item }, index) => [id, question(item, index)])),
  });
  return keyed.map(({ id, item }) => answer(answers[id], item, id));
}

/** A validated choice, keeping Jev's own choice and confidence as provenance detail. */
function choice<Label extends string>(
  response: unknown,
  labels: readonly Label[],
  id: string,
): Judgement<Label> {
  if (!isChoice(response, labels)) {
    throw new Error("Invalid Jev response");
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

/**
 * A Choice answer to the labels it was asked with: every label has a probability, they sum
 * to 1 within rounding, and the selected label is one of them.
 */
function isChoice<Label extends string>(
  value: unknown,
  labels: readonly Label[],
): value is ChoiceResponse<Record<Label, string>> {
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
