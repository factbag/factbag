import type { Settings } from "../config";
import { finding } from "./support/spans";
import type { Finding, Recognizer } from "./types";

/**
 * Locate configured alias phrases as literal, case-sensitive text at word boundaries.
 * A field receives the configured values of the phrases found that fit its type: strings
 * for `String` fields, otherwise entities of exactly the field's class. Repeated phrases
 * keep ambiguous alternatives. Every phrase is scanned so that name recognition can mask
 * it. No fuzzy matching or identity inference occurs.
 */
export const aliases: Recognizer = {
  requires: [],
  scan: ({ chunk, settings }) => {
    const found: Finding[] = [];
    for (const phrase of new Set(settings.aliases.map(({ text }) => text))) {
      let start = chunk.text.indexOf(phrase);
      while (start !== -1) {
        const before = chunk.text.slice(0, start);
        const after = chunk.text.slice(start + phrase.length);
        if (!/[\p{L}\p{N}_]$/u.test(before) && !/^[\p{L}\p{N}_]/u.test(after)) {
          found.push(finding(chunk, start, phrase, phrase));
        }
        start = chunk.text.indexOf(phrase, start + phrase.length);
      }
    }
    return found;
  },
  serves: (type, settings) => fitting(type, settings).length > 0,
  values: (findings, type, settings) => {
    const mentioned = new Set(findings.map(({ value }) => value));
    return fitting(type, settings)
      .filter(({ text }) => mentioned.has(text))
      .map(({ value }) => value);
  },
};

function fitting(type: unknown, settings: Settings): Settings["aliases"] {
  return settings.aliases.filter(({ value }) =>
    type === String
      ? typeof value === "string"
      : typeof value === "object" && value.constructor === type,
  );
}
