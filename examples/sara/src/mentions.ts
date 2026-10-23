/**
 * The candidate domains for one case, read off the text with regular expressions: the
 * people named, the calendar dates written out, and the four-digit years. Jev decides
 * which of them stand in which relation; this only says what the finite domains are.
 */
import { day } from "./calendar";

export type Mentions = Readonly<{
  people: readonly string[];
  dates: readonly Date[];
  /** Four-digit years written on their own, not as part of a full date. */
  years: readonly number[];
  /** Dollar amounts, percentages and the figure after "equal to", as plain numbers. */
  amounts: readonly number[];
}>;

const MONTHS: Readonly<Record<string, number>> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

const MONTH = String.raw`(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sept?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)`;
const ORDINAL = String.raw`(\d{1,2})(?:st|nd|rd|th)?`;
/** "Feb 3rd, 1992", "October 5 2014", "Sept. 14, 2015". */
const MONTH_FIRST = new RegExp(String.raw`\b(${MONTH})\.?\s+${ORDINAL},?\s+(\d{4})\b`, "gu");
/** "2 Feb 2015", "14th September, 2015". */
const DAY_FIRST = new RegExp(String.raw`\b${ORDINAL}\s+(${MONTH})\.?,?\s+(\d{4})\b`, "gu");
/** "Jan 24", "Sep 9th": a day whose year the text gives elsewhere. */
const MONTH_DAY = new RegExp(String.raw`\b(${MONTH})\.?\s+${ORDINAL}\b`, "gu");
const YEAR = /\b(1[89]\d{2}|2[01]\d{2})\b/gu;
const AMOUNT = /\$\s?(\d[\d,]*)|(\d+(?:\.\d+)?)\s?%/gu;
/** "equal to 22", "equal to at most $500": the figure a value question asks about. */
const EQUAL_TO = /\bequal to\s+(?:at most\s+|at least\s+)?\$?\s?(\d[\d,]*(?:\.\d+)?)\b/gu;
const CAPITALISED = /\b[A-Z][a-z]+\b/gu;

/**
 * Capitalised words that are not people in SARA's texts: months, sentence starters,
 * pronouns, and the handful of places and institutions that appear.
 */
const NOT_PEOPLE = new Set(
  [
    ...Object.keys(MONTHS),
    "a",
    "after",
    "also",
    "american",
    "an",
    "and",
    "as",
    "at",
    "baltimore",
    "before",
    "both",
    "but",
    "by",
    "caracas",
    "contradiction",
    "during",
    "entailment",
    "for",
    "from",
    "he",
    "her",
    "his",
    "hospital",
    "hopkins",
    "how",
    "if",
    "in",
    "it",
    "its",
    "johns",
    "maryland",
    "no",
    "nursing",
    "of",
    "on",
    "over",
    "question",
    "school",
    "section",
    "she",
    "since",
    "text",
    "that",
    "the",
    "their",
    "then",
    "they",
    "this",
    "under",
    "university",
    "until",
    "venezuela",
    "what",
    "when",
    "which",
    "while",
    "with",
    "yes",
  ].map((word) => word.toLowerCase()),
);

export function mentions(text: string): Mentions {
  const dates = new Map<string, Date>();
  let stripped = text;
  for (const pattern of [MONTH_FIRST, DAY_FIRST]) {
    stripped = stripped.replace(pattern, (match, ...groups: unknown[]) => {
      const [first, second, year] = groups;
      const [monthName, dayText] =
        pattern === MONTH_FIRST ? [String(first), String(second)] : [String(second), String(first)];
      const month = MONTHS[monthName.toLowerCase()];
      if (month === undefined) {
        return match;
      }
      const iso = `${String(year)}-${String(month).padStart(2, "0")}-${dayText.padStart(2, "0")}`;
      try {
        dates.set(iso, day(iso));
      } catch {
        return match;
      }
      return " ";
    });
  }
  const years = new Set<number>();
  for (const match of stripped.matchAll(YEAR)) {
    years.add(Number(match[0]));
  }
  // A day without a year, such as a list of occasions "during the year 2017", takes the
  // one year the text names on its own; with no year or several, it is left out.
  if (years.size === 1) {
    const [year] = years;
    for (const match of stripped.matchAll(MONTH_DAY)) {
      const month = MONTHS[String(match[1]).toLowerCase()];
      const dayText = String(match[2]);
      if (month === undefined) {
        continue;
      }
      const iso = `${String(year)}-${String(month).padStart(2, "0")}-${dayText.padStart(2, "0")}`;
      try {
        dates.set(iso, day(iso));
      } catch {
        // Not a calendar day, such as "Feb 30".
      }
    }
  }
  const amounts = new Set<number>();
  for (const match of text.matchAll(AMOUNT)) {
    amounts.add(Number((match[1] ?? match[2] ?? "").replaceAll(",", "")));
  }
  for (const match of text.matchAll(EQUAL_TO)) {
    amounts.add(Number((match[1] ?? "").replaceAll(",", "")));
  }
  const people: string[] = [];
  for (const match of text.matchAll(CAPITALISED)) {
    const name = match[0];
    if (!NOT_PEOPLE.has(name.toLowerCase()) && !people.includes(name)) {
      people.push(name);
    }
  }
  return {
    people,
    dates: [...dates.values()].sort((a, b) => a.getTime() - b.getTime()),
    years: [...years].sort((a, b) => a - b),
    amounts: [...amounts].sort((a, b) => a - b),
  };
}
