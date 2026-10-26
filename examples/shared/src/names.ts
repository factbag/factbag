/**
 * The people a text names, read off it with regular expressions: a name is a run of
 * adjacent capitalised words, with a roman numeral allowed at its end, so "Walter Brown
 * Family Trust II" is one name, as the text writes it, and so is "Johns Hopkins University".
 * Months and the function words and pronouns that open a sentence are not names. Nothing
 * here is particular to any text or benchmark; a capitalised place or institution is taken
 * for a person, and that is the scanner's known limit. The scanner reports what is
 * explicitly in the text and nothing more: it does not resolve who "her spouse" is.
 */

/** One occurrence of a name in the text: where it is and what it says. */
export type NameSpan = Readonly<{
  value: string;
  start: number;
  end: number;
  text: string;
}>;

export type Names = Readonly<{
  /** Each distinct name once, in order of first appearance. */
  people: readonly string[];
  /** Every occurrence, in text order. */
  spans: readonly NameSpan[];
}>;

export const MONTH_NAMES: readonly string[] = [
  "jan",
  "january",
  "feb",
  "february",
  "mar",
  "march",
  "apr",
  "april",
  "may",
  "jun",
  "june",
  "jul",
  "july",
  "aug",
  "august",
  "sep",
  "sept",
  "september",
  "oct",
  "october",
  "nov",
  "november",
  "dec",
  "december",
];

/** A capitalised word, or a roman numeral such as the "II" that ends a name. */
const NAME_WORD = /\b(?:[A-Z][a-z]+|II|III|IV|V|VI|VII|VIII|IX|X)\b/gu;
const ROMAN = /^(?:II|III|IV|V|VI|VII|VIII|IX|X)$/u;

/** Capitalised words that are not names: the months, function words and pronouns. */
const NOT_PEOPLE = new Set([
  ...MONTH_NAMES,
  "a",
  "after",
  "also",
  "an",
  "and",
  "as",
  "at",
  "before",
  "both",
  "but",
  "by",
  "during",
  "for",
  "from",
  "he",
  "her",
  "his",
  "how",
  "if",
  "in",
  "it",
  "its",
  "no",
  "of",
  "on",
  "over",
  "she",
  "since",
  "that",
  "the",
  "their",
  "then",
  "they",
  "this",
  "under",
  "until",
  "what",
  "when",
  "which",
  "while",
  "with",
  "yes",
]);

export function names(text: string): Names {
  const people: string[] = [];
  const spans: NameSpan[] = [];
  // Adjacent capitalised words, one space apart, form one name; a roman numeral may end
  // it but not begin it, and a month or function word ends the run without joining it.
  let run: { start: number; end: number } | undefined;
  const close = (): void => {
    if (run === undefined) {
      return;
    }
    const name = text.slice(run.start, run.end);
    spans.push({ value: name, start: run.start, end: run.end, text: name });
    if (!people.includes(name)) {
      people.push(name);
    }
    run = undefined;
  };
  for (const match of text.matchAll(NAME_WORD)) {
    const word = match[0];
    const roman = ROMAN.test(word);
    if (!roman && NOT_PEOPLE.has(word.toLowerCase())) {
      close();
      continue;
    }
    if (run !== undefined && match.index === run.end + 1 && text[run.end] === " ") {
      run = { start: run.start, end: match.index + word.length };
      continue;
    }
    close();
    if (!roman) {
      run = { start: match.index, end: match.index + word.length };
    }
  }
  close();
  return { people, spans };
}
