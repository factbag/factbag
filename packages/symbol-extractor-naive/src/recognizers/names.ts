import type { Entity } from "@factbag/core/dsl";
import { finding, masked, prerequisiteFindings } from "./support/spans";
import type { Finding, Recognizer } from "./types";

const STOP = new Set(
  (
    "a after also an and as at before between both but by during for from he her his how i if in it its no of on or over she since that the their then they this under until what when where which while with yes " +
    "jan january feb february mar march apr april may jun june jul july aug august sep sept september oct october nov november dec december"
  ).split(" "),
);
const WORD =
  /(?<![\p{L}\p{N}_])(?:\p{Lu}[\p{Ll}]+(?:['’-]\p{Lu}?[\p{Ll}]+)*|II|III|IV|V|VI|VII|VIII|IX|X)(?![\p{L}\p{N}_])/gu;
const ROMAN = /^(?:II|III|IV|V|VI|VII|VIII|IX|X)$/u;

/**
 * Propose names from adjacent capitalized words, excluding month names, common
 * sentence openers, and spans already recognized as dates or configured aliases.
 * Keep trailing Roman numerals and remove possessive endings. Capitalization is only
 * a heuristic: institutions can be mistaken for people, and pronouns are not resolved.
 * A configured factory decides how candidate names become entities.
 */
export const names: Recognizer = {
  requires: ["dates", "aliases"],
  scan: ({ chunk, prerequisites }) => {
    const found: Finding[] = [];
    const text = masked(chunk, prerequisiteFindings(prerequisites));
    let run: { start: number; end: number } | undefined;
    const close = (): void => {
      if (run !== undefined) {
        const name = chunk.text.slice(run.start, run.end);
        found.push(finding(chunk, run.start, name, name));
        run = undefined;
      }
    };
    for (const match of text.matchAll(WORD)) {
      const word = match[0].replace(/['’]s$/u, "");
      if (STOP.has(word.toLowerCase())) {
        close();
      } else if (run !== undefined && /^ +$/u.test(chunk.text.slice(run.end, match.index))) {
        run = { start: run.start, end: match.index + word.length };
      } else {
        close();
        if (!ROMAN.test(word)) {
          run = { start: match.index, end: match.index + word.length };
        }
      }
    }
    close();
    return found;
  },
  /** Names are offered as strings, or as entities of classes with a configured factory. */
  serves: (type, settings) => type === String || settings.factories.has(type),
  values: (findings, type, settings) => {
    const create = settings.factories.get(type);
    return findings.flatMap(({ value }): (string | Entity)[] =>
      typeof value === "string" ? [create === undefined ? value : create(value)] : [],
    );
  },
};
