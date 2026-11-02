import { finding } from "./support/spans";
import type { Finding, Recognizer } from "./types";

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTH = String.raw`(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sept?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)`;
const ORDINAL = String.raw`(\d{1,2})(?:st|nd|rd|th)?`;
const MONTH_FIRST = new RegExp(String.raw`\b(${MONTH})\.?\s+${ORDINAL},?\s+(\d{4})\b`, "giu");
const DAY_FIRST = new RegExp(String.raw`\b${ORDINAL}\s+(${MONTH})\.?,?\s+(\d{4})\b`, "giu");
const ISO = /\b(\d{4})-(\d{2})-(\d{2})\b/gu;

/**
 * Recognize complete calendar days written as English month-name dates or YYYY-MM-DD.
 * Validate the calendar date and retain an ISO string with its original source span.
 * Name recognition masks these spans. Missing years and invalid
 * days produce no date candidate; no current-date context is used. Field values are
 * `Date` objects at UTC midnight.
 */
export const dates: Recognizer = {
  requires: [],
  scan: ({ chunk }) => {
    const found: Finding[] = [];
    for (const pattern of [MONTH_FIRST, DAY_FIRST, ISO]) {
      for (const match of chunk.text.matchAll(pattern)) {
        const monthName = pattern === MONTH_FIRST ? match[1] : match[2];
        const year = pattern === ISO ? match[1] : match[3];
        const month =
          pattern === ISO
            ? Number(match[2])
            : MONTHS.indexOf((monthName ?? "").slice(0, 3).toLowerCase()) + 1;
        const day = pattern === ISO ? match[3] : pattern === MONTH_FIRST ? match[2] : match[1];
        const iso = `${year ?? ""}-${String(month).padStart(2, "0")}-${(day ?? "").padStart(2, "0")}`;
        const date = new Date(`${iso}T00:00:00Z`);
        if (!Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === iso) {
          found.push(finding(chunk, match.index, match[0], iso));
        }
      }
    }
    return found;
  },
  serves: (type) => type === Date,
  values: (findings) =>
    findings.flatMap(({ value }) =>
      typeof value === "string" ? [new Date(`${value}T00:00:00Z`)] : [],
    ),
};
