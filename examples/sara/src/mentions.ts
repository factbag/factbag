/**
 * The candidate domains for one case, read off the text with regular expressions: the
 * people named, the calendar dates written out in full, the four-digit years, and the
 * amounts. Jev decides which of them stand in which relation; this only says what the
 * finite domains are.
 *
 * The boundary is deliberate: the scanner reports what is explicitly in the text and
 * nothing more. It does not resolve who "her spouse" is, and does not give a day its year
 * from elsewhere in the passage. What the text leaves out is left out, and the facts that
 * would need it stay unknown. A range of years the text states as one ("from 2004 to
 * 2019", "between 2004 and 2019", "the years 2015 through 2020") is explicit about every
 * year in it, so each of those years is a candidate; Jev still decides, year by year,
 * which facts hold. Two years the text does not join that way ("in 2015 and in 2019") are
 * two years, and nothing is filled in between them. The names come from the shared
 * scanner in `@factbag/eval-shared/names`: a run of adjacent capitalised words, with a
 * roman numeral allowed at its end, so "Walter Brown Family Trust II" is one name, as the
 * text writes it, and so is "Johns Hopkins University".
 */
import { names } from "@factbag/eval-shared/names";
import { day } from "./calendar";

type SpanKind = "person" | "date" | "year" | "amount" | "range";

/** One occurrence of a candidate in the text: where it is and what it says. */
type Span = Readonly<{
  kind: SpanKind;
  /**
   * The candidate as the domains hold it: a name, an ISO day, a year or a number; for a
   * range of years, "2004 to 2019", whose every year the years then hold.
   */
  value: string;
  start: number;
  end: number;
  text: string;
}>;

export type Mentions = Readonly<{
  people: readonly string[];
  /** Complete dates: a day, a month and a year written together. */
  dates: readonly Date[];
  /** Four-digit years, on their own, inside a complete date, or within a stated range. */
  years: readonly number[];
  /** Dollar amounts, percentages, ages and the figure after "equal to", as plain numbers. */
  amounts: readonly number[];
  /** Every occurrence behind the four lists, in text order. */
  spans: readonly Span[];
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
const YEAR = /\b(1[89]\d{2}|2[01]\d{2})\b/gu;
/** "from 2004 to 2019", "the years 2015 through 2020", "2004 until 2019". */
const YEAR_TO_YEAR =
  /\b(1[89]\d{2}|2[01]\d{2})\s+(?:to|through|until|till)\s+(1[89]\d{2}|2[01]\d{2})\b/gu;
/** "between 2004 and 2019". Without "between", two years joined by "and" are two years. */
const BETWEEN_YEARS = /\b[Bb]etween\s+(1[89]\d{2}|2[01]\d{2})\s+and\s+(1[89]\d{2}|2[01]\d{2})\b/gu;
const AMOUNT = /\$\s?(\d[\d,]*)|(\d+(?:\.\d+)?)\s?%/gu;
/** "67 years old": an age, a number the text states. */
const AGE = /\b(\d{1,3})\s+years?\s+old\b/gu;
/** "equal to 22", "equal to at most $500": the figure a value question asks about. */
const EQUAL_TO = /\bequal to\s+(?:at most\s+|at least\s+)?\$?\s?(\d[\d,]*(?:\.\d+)?)\b/gu;
function blank(match: string): string {
  return " ".repeat(match.length);
}

export function mentions(text: string): Mentions {
  const spans: Span[] = [];
  const dates = new Map<string, Date>();
  let undated = text;
  for (const pattern of [MONTH_FIRST, DAY_FIRST]) {
    undated = undated.replace(pattern, (match: string, ...groups: unknown[]) => {
      const [first, second, year] = groups;
      const index = groups.at(-2);
      const [monthName, dayText] =
        pattern === MONTH_FIRST ? [String(first), String(second)] : [String(second), String(first)];
      const month = MONTHS[monthName.toLowerCase()];
      if (month === undefined || typeof index !== "number") {
        return match;
      }
      const iso = `${String(year)}-${String(month).padStart(2, "0")}-${dayText.padStart(2, "0")}`;
      try {
        dates.set(iso, day(iso));
      } catch {
        // Not a calendar day, such as "Feb 30, 2015".
        return match;
      }
      spans.push({
        kind: "date",
        value: iso,
        start: index,
        end: index + match.length,
        text: match,
      });
      // Blank the date at its own length, so later positions still refer to the text.
      return blank(match);
    });
  }
  const amounts = new Set<number>();
  for (const match of text.matchAll(AMOUNT)) {
    const value = Number((match[1] ?? match[2] ?? "").replaceAll(",", ""));
    amounts.add(value);
    spans.push(span("amount", value, match.index, match[0]));
  }
  for (const match of text.matchAll(AGE)) {
    const value = Number(match[1]);
    amounts.add(value);
    spans.push(span("amount", value, match.index, match[0]));
  }
  for (const match of text.matchAll(EQUAL_TO)) {
    const figure = match[1] ?? "";
    const start = match.index + match[0].lastIndexOf(figure);
    const value = Number(figure.replaceAll(",", ""));
    amounts.add(value);
    if (!spans.some((entry) => entry.kind === "amount" && entry.end === start + figure.length)) {
      spans.push(span("amount", value, start, figure));
    }
  }
  // A dollar amount such as "$2000" is not a year; a year inside a full date is one.
  const years = new Set<number>();
  for (const match of text.replace(AMOUNT, blank).matchAll(YEAR)) {
    const value = Number(match[0]);
    years.add(value);
    spans.push(span("year", value, match.index, match[0]));
  }
  // A range the text states as one names every year in it. Full dates are blanked first,
  // so "from Feb 1st, 2011 to November 19th, 2019" is two dates and no range of years.
  for (const pattern of [YEAR_TO_YEAR, BETWEEN_YEARS]) {
    for (const match of undated.replace(AMOUNT, blank).matchAll(pattern)) {
      const first = Number(match[1]);
      const last = Number(match[2]);
      if (!(first < last)) {
        continue;
      }
      for (let year = first; year <= last; year += 1) {
        years.add(year);
      }
      spans.push(span("range", `${String(first)} to ${String(last)}`, match.index, match[0]));
    }
  }
  const found = names(text);
  for (const entry of found.spans) {
    spans.push(span("person", entry.value, entry.start, entry.text));
  }
  return {
    people: found.people,
    dates: [...dates.values()].sort((a, b) => a.getTime() - b.getTime()),
    years: [...years].sort((a, b) => a - b),
    amounts: [...amounts].sort((a, b) => a - b),
    spans: spans.sort((a, b) => a.start - b.start || a.end - b.end),
  };
}

function span(kind: SpanKind, value: string | number, start: number, text: string): Span {
  return { kind, value: String(value), start, end: start + text.length, text };
}
