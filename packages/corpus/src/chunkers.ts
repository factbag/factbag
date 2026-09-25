import type { Chunker, RecursiveChunkOptions, TextRange } from "./types";
import { boundaryAt, graphemeBoundaries, nonnegativeInteger, positiveInteger } from "./text";

/**
 * Construct a bounded splitter that prefers paragraph, line, and word boundaries.
 * Ranges are produced lazily and never split a Unicode grapheme. Custom measures
 * are checked on exact substrings; a grapheme that cannot fit raises RangeError.
 */
export function recursive(options: RecursiveChunkOptions): Chunker {
  const { size, overlap = 0, measure } = options;
  const separators = [...(options.separators ?? ["\n\n", "\n", " "])];
  positiveInteger(size, "size");
  nonnegativeInteger(overlap, "overlap");
  if (overlap >= size) {
    throw new RangeError("overlap must be smaller than size");
  }
  if (separators.some((separator) => separator.length === 0)) {
    throw new Error("Separators must be nonempty; grapheme fallback is automatic");
  }

  return Object.freeze({
    name: "recursive",
    *split(text: string): Generator<TextRange, void, unknown> {
      const boundaries = graphemeBoundaries(text);
      const indices = new Map(boundaries.map((offset, index) => [offset, index]));
      const last = boundaries.length - 1;

      function count(start: number, end: number): number {
        if (measure === undefined) {
          return end - start;
        }
        const value = measure(
          text.slice(boundaryAt(boundaries, start), boundaryAt(boundaries, end)),
        );
        if (!Number.isSafeInteger(value) || value < 0) {
          throw new RangeError("measure must return a nonnegative safe integer");
        }
        return value;
      }

      function boundedEnd(start: number): number {
        if (measure === undefined) {
          return Math.min(start + size, last);
        }
        let end = start;
        // Do not assume measurements are additive (tokenization generally is not).
        while (end < last && count(start, end + 1) <= size) {
          end += 1;
        }
        if (end === start) {
          throw new RangeError("A single grapheme exceeds the chunk size");
        }
        return end;
      }

      function preferredEnd(start: number, hardEnd: number): number {
        if (hardEnd === last) {
          return hardEnd;
        }
        const startOffset = boundaryAt(boundaries, start);
        const endOffset = boundaryAt(boundaries, hardEnd);
        for (const separator of separators) {
          const offset = text.lastIndexOf(separator, endOffset - separator.length);
          const candidate = indices.get(offset + separator.length);
          if (
            offset >= startOffset &&
            candidate !== undefined &&
            candidate > start &&
            candidate <= hardEnd
          ) {
            return candidate;
          }
        }
        return hardEnd;
      }

      function nextStart(start: number, end: number): number {
        if (overlap === 0) {
          return end;
        }
        if (measure === undefined) {
          return Math.max(start + 1, end - overlap);
        }
        let next = end;
        while (next > start + 1 && count(next - 1, end) <= overlap) {
          next -= 1;
        }
        return next;
      }

      let start = 0;
      while (start < last) {
        const end = preferredEnd(start, boundedEnd(start));
        yield { start: boundaryAt(boundaries, start), end: boundaryAt(boundaries, end) };
        if (end === last) {
          return;
        }
        start = nextStart(start, end);
      }
    },
  });
}
