import type { Chunk } from "@factbag/corpus";
import type { Settings } from "./config";
import type { Registry } from "./recognizers";
import type { Finding, Mention, RecognizerName } from "./recognizers/types";

/**
 * Run recognizers lazily, once each per extractor, after their prerequisites. A
 * recognizer sees only the findings of the recognizers it requires, so results do
 * not depend on query order. Cached findings are frozen because later recognizers
 * share them.
 */
export function scheduler(
  chunks: readonly Chunk[],
  settings: Settings,
  registry: Registry,
): (name: RecognizerName) => readonly Finding[] {
  const cache = new Map<RecognizerName, readonly Finding[]>();
  const visiting = new Set<RecognizerName>();
  const recognize = (name: RecognizerName): readonly Finding[] => {
    const cached = cache.get(name);
    if (cached !== undefined) {
      return cached;
    }
    if (visiting.has(name)) {
      throw new Error(`Cyclic recognizer dependency: ${name}`);
    }
    visiting.add(name);
    try {
      const { requires, scan } = registry[name];
      const prerequisites = new Map(
        requires.map((dependency) => [dependency, recognize(dependency)] as const),
      );
      const findings = freeze(
        consolidate(chunks.flatMap((chunk) => scan({ chunk, prerequisites, settings }))),
      );
      cache.set(name, findings);
      return findings;
    } finally {
      visiting.delete(name);
    }
  };
  return recognize;
}

/**
 * Merge equal values, retaining every distinct source occurrence in first-seen order.
 * Repeated mentions then do not multiply candidates. Equal names are not proof of a
 * shared real-world identity; the field's entity factory decides that.
 */
function consolidate(findings: readonly Finding[]): readonly Finding[] {
  const byValue = new Map<string, Finding>();
  for (const current of findings) {
    const key = JSON.stringify(current.value);
    const mentions = [...(byValue.get(key)?.mentions ?? []), ...current.mentions];
    byValue.set(key, {
      value: current.value,
      mentions: mentions.filter(
        (mention, index) => mentions.findIndex((other) => sameMention(mention, other)) === index,
      ),
    });
  }
  return [...byValue.values()];
}

function sameMention(left: Mention, right: Mention): boolean {
  return (
    left.chunk.id === right.chunk.id &&
    left.chunk.documentId === right.chunk.documentId &&
    left.start === right.start &&
    left.end === right.end
  );
}

function freeze(findings: readonly Finding[]): readonly Finding[] {
  for (const current of findings) {
    for (const mention of current.mentions) {
      Object.freeze(mention);
    }
    Object.freeze(current.mentions);
    if (typeof current.value === "object") {
      Object.freeze(current.value);
    }
    Object.freeze(current);
  }
  return Object.freeze(findings);
}
