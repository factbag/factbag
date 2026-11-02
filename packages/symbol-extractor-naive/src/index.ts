import { fieldEquals } from "@factbag/core/dsl";
import type { Entity, Scalar } from "@factbag/core/dsl";
import type { Chunk } from "@factbag/corpus";
import type { ChunkSymbolExtractor } from "@factbag/system-one";
import { configure } from "./config";
import type { SymbolExtractorConfig } from "./config";
import { RECOGNIZER_NAMES, recognizers } from "./recognizers";
import { scheduler } from "./scheduler";

export type { SymbolExtractorConfig } from "./config";

type Candidate = Scalar | Entity;

/**
 * Extract candidates for requested predicate fields, chosen by each field's type:
 * dates for `Date`, every figure and year for `Number`, names and string aliases for
 * `String`, and names (through a configured factory) and aliases for entity classes.
 * Field names carry no meaning. Recognition starts on query and runs each needed
 * recognizer once per extractor.
 * @beta
 */
export function createChunkSymbolExtractor(
  chunks: readonly Chunk[],
  config: SymbolExtractorConfig = {},
): ChunkSymbolExtractor {
  const settings = configure(config);
  const recognize = scheduler([...chunks], settings, recognizers);
  const cache = new Map<unknown, readonly Candidate[]>();
  const candidates = (type: unknown): readonly Candidate[] => {
    const cached = cache.get(type);
    if (cached !== undefined) {
      return cached;
    }
    const found = RECOGNIZER_NAMES.filter((name) => recognizers[name].serves(type, settings))
      .flatMap((name) => recognizers[name].values(recognize(name), type, settings))
      .filter((value, index, all) => all.findIndex((other) => fieldEquals(value, other)) === index)
      .sort(ascending);
    cache.set(type, found);
    return found;
  };
  return {
    query: (requests) =>
      new Map(
        [...requests].map(([predicate, fields]) => [
          predicate,
          Object.fromEntries(
            fields.map((field) => [
              field,
              // Give callers fresh arrays and Date objects, retaining entity identities.
              candidates(predicate.params[field]).map((value) =>
                value instanceof Date ? new Date(value.getTime()) : value,
              ),
            ]),
          ),
        ]),
      ),
  };
}

/** Order numbers and dates ascending; leave strings and entities in recognition order. */
function ascending(left: Candidate, right: Candidate): number {
  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }
  if (left instanceof Date && right instanceof Date) {
    return left.getTime() - right.getTime();
  }
  return 0;
}
