import type { Entity, Scalar } from "@factbag/core/dsl";
import type { Chunk } from "@factbag/corpus";
import type { Settings } from "../config";

/**
 * An occurrence in a source chunk. Offsets are zero-based UTF-16 code units into
 * `chunk.text`, with an inclusive start and exclusive end (as in `String.slice`).
 * They are relative to the chunk, not the document-level `chunk.range`.
 */
export type Mention = {
  readonly chunk: Chunk;
  readonly start: number;
  readonly end: number;
};

/**
 * An explicitly stated, inclusive range of calendar years. Preserve the range
 * until field mapping requires individual years; it does not imply exact dates.
 */
type YearRange = {
  readonly start: number;
  readonly end: number;
  readonly precision: "year";
};

/**
 * A candidate value supported by source mentions, not an asserted fact. Complete
 * dates use YYYY-MM-DD strings; names and alias phrases are not resolved identities.
 */
export type Finding = {
  readonly value: string | number | YearRange;
  readonly mentions: readonly Mention[];
};

export type RecognizerName = "dates" | "figures" | "aliases" | "names";

/** What a recognizer reads when scanning one chunk. */
export type ScanInput = {
  readonly chunk: Chunk;
  /** Consolidated findings of each declared prerequisite, across all chunks. */
  readonly prerequisites: ReadonlyMap<RecognizerName, readonly Finding[]>;
  readonly settings: Settings;
};

/**
 * One recognizer: what it needs, how it scans, which field types it offers values
 * to, and how its findings become those values. Scanning is pure and synchronous.
 */
export type Recognizer = {
  /** Recognizers whose findings this one reads, typically to mask their spans. */
  readonly requires: readonly RecognizerName[];
  readonly scan: (input: ScanInput) => readonly Finding[];
  /** Whether this recognizer can offer values to a field of `type`. */
  readonly serves: (type: unknown, settings: Settings) => boolean;
  /** Convert consolidated findings into candidate values for a field of `type`. */
  readonly values: (
    findings: readonly Finding[],
    type: unknown,
    settings: Settings,
  ) => readonly (Scalar | Entity)[];
};
