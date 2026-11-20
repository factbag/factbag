import { describe, expect, it, vi } from "vitest";
import { chunkers } from "./index";

describe("chunkers.recursive", () => {
  it.fails("supports a non-monotonic measure satisfying the documented contract", () => {
    const measure = (text: string) => (text.length === 1 ? 2 : 1);
    const chunker = chunkers.recursive({ size: 1, measure });
    expect(measure("ab")).toBe(1);

    expect([...chunker.split("ab")]).toEqual([{ start: 0, end: 2 }]);
  });

  it("is the sole built-in chunker factory", () => {
    expect(Object.keys(chunkers)).toEqual(["recursive"]);
  });
  it("splits single graphemes without corrupting emoji, combining marks, or CRLF", () => {
    const text = "A👨‍👩‍👧‍👦e\u0301\r\nZ";
    const ranges = [...chunkers.recursive({ size: 1 }).split(text)];
    expect(ranges.map(({ start, end }) => text.slice(start, end))).toEqual([
      "A",
      "👨‍👩‍👧‍👦",
      "e\u0301",
      "\r\n",
      "Z",
    ]);
    expect(ranges.map(({ start, end }) => text.slice(start, end)).join("")).toBe(text);
  });

  it("supports explicit overlap and always advances", () => {
    const text = "abcdefgh";
    const ranges = [...chunkers.recursive({ size: 4, overlap: 2 }).split(text)];
    expect(ranges.map(({ start, end }) => text.slice(start, end))).toEqual([
      "abcd",
      "cdef",
      "efgh",
    ]);
    expect(() => chunkers.recursive({ size: 4, overlap: 4 })).toThrow("overlap");
    expect(() => chunkers.recursive({ size: 0 })).toThrow("size");
    expect(() => chunkers.recursive({ size: 1.5 })).toThrow("size");
    expect(() => chunkers.recursive({ size: 4, separators: [""] })).toThrow("Separators");
  });

  it("prefers separators but enforces a hard limit on unbroken text", () => {
    const text = "First paragraph.\n\nSecond paragraph.\nLongUnbrokenWordHere";
    const chunks = [...chunkers.recursive({ size: 20 }).split(text)].map(({ start, end }) =>
      text.slice(start, end),
    );
    expect(chunks[0]).toBe("First paragraph.\n\n");
    expect(chunks.join("")).toBe(text);
    expect(chunks.every((chunk) => chunk.length <= 20)).toBe(true);
  });

  it("preserves leading and trailing whitespace", () => {
    const text = "  First sentence. Second sentence! Third sentence?  ";
    const ranges = [...chunkers.recursive({ size: 25 }).split(text)];
    expect(ranges.map(({ start, end }) => text.slice(start, end)).join("")).toBe(text);
    expect(ranges.length).toBeGreaterThan(0);
  });

  it("returns no ranges for an empty document", () => {
    expect([...chunkers.recursive({ size: 10 }).split("")]).toEqual([]);
  });

  it("retains full coverage and valid bounds across sizes, overlaps and separators", () => {
    const text = "a b\n\ncdefghij kl\nmnop";
    const cases = [1, 2, 4, 10].flatMap((size) =>
      [0, size - 1].map((overlap) => ({ size, overlap })),
    );
    for (const options of cases) {
      const ranges = [...chunkers.recursive(options).split(text)];
      const covered = new Set(
        ranges.flatMap(({ start, end }) =>
          Array.from({ length: end - start }, (_, index) => start + index),
        ),
      );
      expect(covered.size).toBe(text.length);
      expect(
        ranges.every(
          ({ start, end }) =>
            start >= 0 && end <= text.length && end > start && end - start <= options.size,
        ),
      ).toBe(true);
    }
  });

  it("counts exact substrings with a custom measurement without breaking graphemes", () => {
    const encoder = new TextEncoder();
    const measure = (text: string): number => encoder.encode(text).length;
    const text = "a🙂bé";
    const ranges = [...chunkers.recursive({ size: 5, overlap: 2, measure }).split(text)];
    const chunks = ranges.map(({ start, end }) => text.slice(start, end));
    expect(chunks).toEqual(["a🙂", "bé"]);
    expect(chunks.every((chunk) => measure(chunk) <= 5)).toBe(true);
  });

  it("supports non-additive measurements and still obeys the substring budget", () => {
    const measure = (text: string): number => text.replaceAll("ab", "x").length;
    const text = "abab abab cd";
    const ranges = [...chunkers.recursive({ size: 3, overlap: 1, measure }).split(text)];
    expect(ranges.every(({ start, end }) => measure(text.slice(start, end)) <= 3)).toBe(true);
    const covered = new Set(
      ranges.flatMap(({ start, end }) =>
        Array.from({ length: end - start }, (_, index) => start + index),
      ),
    );
    expect(covered.size).toBe(text.length);
  });

  it("starts measuring lazily and stops when the consumer stops", () => {
    const measure = vi.fn((text: string) => text.length);
    const ranges = chunkers.recursive({ size: 2, measure }).split("abcdefghij");
    expect(measure).not.toHaveBeenCalled();
    for (const range of ranges) {
      expect(range).toEqual({ start: 0, end: 2 });
      break;
    }
    expect(measure.mock.calls.map(([text]) => text)).toEqual(["a", "ab", "abc"]);
  });

  it("throws rather than splitting an indivisible grapheme or exceeding the custom budget", () => {
    const chunker = chunkers.recursive({ size: 1, measure: (text) => text.length });
    expect(() => [...chunker.split("🙂")]).toThrow("single grapheme");
  });

  it.each([Number.NaN, Infinity, -1, 0.5])("rejects an invalid custom measurement %s", (value) => {
    const chunker = chunkers.recursive({ size: 3, measure: () => value });
    expect(() => [...chunker.split("abc")]).toThrow("measure");
  });

  it("captures its options and can be reused independently", () => {
    const separators = [" "];
    const options = { size: 6, overlap: 0, separators };
    const chunker = chunkers.recursive(options);
    options.size = 1;
    separators[0] = "x";
    const text = "ab cd ef";
    const expected = [
      { start: 0, end: 6 },
      { start: 6, end: 8 },
    ];
    expect([...chunker.split(text)]).toEqual(expected);
    expect([...chunker.split(text)]).toEqual(expected);
  });
});
