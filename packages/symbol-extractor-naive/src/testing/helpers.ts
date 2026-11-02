import { expect } from "vitest";
import { configure } from "../config";
import { recognizers } from "../recognizers";
import type { Finding, RecognizerName } from "../recognizers/types";
import { scheduler } from "../scheduler";

/**
 * Assert a recognizer's complete, consolidated findings for one chunk of text. Its
 * prerequisites run first, as in an extractor; only its own findings are compared.
 * Alias phrases are configured as string aliases of themselves.
 * Mention strings are the exact source slices, in first-seen order. The chunk is
 * frozen, and the scheduler freezes prerequisite findings, to catch mutation.
 */
export function expectFindings(
  name: RecognizerName,
  text: string,
  expected: readonly { readonly value: Finding["value"]; readonly mentions: readonly string[] }[],
  aliasPhrases: readonly string[] = [],
): void {
  const chunk = Object.freeze({
    documentId: "test",
    id: "test-chunk",
    range: Object.freeze({ start: 0, end: text.length }),
    text,
  });
  const settings = configure({
    aliases: aliasPhrases.map((phrase) => ({ text: phrase, value: phrase })),
  });
  const findings = scheduler([chunk], settings, recognizers)(name);
  for (const { mentions } of findings) {
    for (const mention of mentions) {
      expect(mention.chunk).toBe(chunk);
      expect(Number.isInteger(mention.start)).toBe(true);
      expect(Number.isInteger(mention.end)).toBe(true);
      expect(mention.start).toBeGreaterThanOrEqual(0);
      expect(mention.end).toBeGreaterThan(mention.start);
      expect(mention.end).toBeLessThanOrEqual(text.length);
    }
  }
  expect(
    findings.map(({ value, mentions }) => ({
      value,
      mentions: mentions.map(({ start, end }) => text.slice(start, end)),
    })),
  ).toEqual(expected);
}
