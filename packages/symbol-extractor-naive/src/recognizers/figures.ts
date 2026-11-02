import { finding } from "./support/spans";
import type { Finding, Recognizer } from "./types";

const FIGURE = /(?<![\p{L}\p{N}_.,])[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?![\d,]*\d)/gu;
const YEAR = String.raw`(?:1[89]\d{2}|2[01]\d{2})`;
const YEAR_RANGES = [
  new RegExp(String.raw`\b(${YEAR})\s+(?:to|through|until|till)\s+(${YEAR})\b`, "giu"),
  new RegExp(String.raw`\bbetween\s+(${YEAR})\s+and\s+(${YEAR})\b`, "giu"),
  new RegExp(String.raw`(?<![\d-])\b(${YEAR})\s*[-–—]\s*(${YEAR}|\d{2})\b(?![-–—]\d)`, "gu"),
];

/**
 * Recognize every figure in the text: amounts, percentages, ages, counts, dates' parts,
 * and years alike. Currency and percent signs are dropped and stated scale is kept, so
 * "$2,000.50" offers 2000.5 and "40%" offers 40. Explicitly joined year ranges from 1800
 * through 2199 also offer every year they span: "2015 to 2017" offers 2016, and
 * "1992–93" offers 1993. Separate or reversed years imply nothing in between. Jev
 * decides which number fits which field.
 */
export const figures: Recognizer = {
  requires: [],
  scan: ({ chunk }) => {
    const found: Finding[] = [...chunk.text.matchAll(FIGURE)].map((match) =>
      finding(chunk, match.index, match[0], Number(match[0].replaceAll(",", ""))),
    );
    for (const pattern of YEAR_RANGES) {
      for (const match of chunk.text.matchAll(pattern)) {
        const start = Number(match[1]);
        const end = endpoint(start, match[2] ?? "");
        if (end >= start && end <= 2199) {
          found.push(finding(chunk, match.index, match[0], { start, end, precision: "year" }));
        }
      }
    }
    return found;
  },
  serves: (type) => type === Number,
  values: (findings) =>
    findings.flatMap(({ value }): number[] => {
      if (typeof value === "number") {
        return [value];
      }
      if (typeof value === "object") {
        return Array.from(
          { length: value.end - value.start + 1 },
          (_, index) => value.start + index,
        );
      }
      return [];
    }),
};

/** Expand an abbreviated endpoint to the next matching year at or after the start. */
function endpoint(start: number, text: string): number {
  const value = Number(text);
  if (text.length !== 2) {
    return value;
  }
  const end = Math.floor(start / 100) * 100 + value;
  return end < start ? end + 100 : end;
}
