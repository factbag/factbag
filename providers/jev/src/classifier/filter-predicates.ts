import type { Chunk } from "@factbag/corpus";
import type { Settings } from "../settings";
import type { ClassifiablePredicate } from "./types";

/** Retain the predicates relevant to this passage. This is the first pipeline step. */
export async function filterPredicates({
  chunk,
  predicates,
  config,
}: {
  chunk: Chunk;
  predicates: readonly ClassifiablePredicate[];
  config: Settings;
}): Promise<readonly ClassifiablePredicate[]> {
  if (!config.routing) {
    return predicates;
  }
  return (
    (await config.model.relevance({ text: chunk.text, subjects: predicates }))
      /** Keep predicates the passage is relevant to with enough confidence. */
      .filter(({ relevance }) => relevance >= config.predicateThreshold)
      .map(({ subject }) => subject)
  );
}
