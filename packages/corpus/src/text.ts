import type { TextRange } from "./types";

export function positiveInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive safe integer`);
  }
}

export function nonnegativeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} must be a nonnegative safe integer`);
  }
}

export function graphemeBoundaries(text: string): readonly number[] {
  const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
  return [...Array.from(segmenter.segment(text), (segment) => segment.index), text.length];
}

export function validateRange(range: TextRange, boundaries: ReadonlySet<number>): void {
  if (
    !Number.isSafeInteger(range.start) ||
    !Number.isSafeInteger(range.end) ||
    range.start >= range.end ||
    !boundaries.has(range.start) ||
    !boundaries.has(range.end)
  ) {
    throw new Error("Range must be nonempty, within the text, and on grapheme boundaries");
  }
}

export function boundaryAt(boundaries: readonly number[], index: number): number {
  const boundary = boundaries[index];
  if (boundary === undefined) {
    throw new Error("Invalid text boundary index");
  }
  return boundary;
}
