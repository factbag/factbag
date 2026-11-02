import type { Chunk } from "@factbag/corpus";
import type { Finding } from "../types";

export function finding(
  chunk: Chunk,
  start: number,
  text: string,
  value: Finding["value"],
): Finding {
  return { value, mentions: [{ chunk, start, end: start + text.length }] };
}

/** Blank the chunk's spans covered by `findings` without changing UTF-16 offsets. */
export function masked(chunk: Chunk, findings: readonly Finding[]): string {
  const spans = findings
    .flatMap((current) => current.mentions)
    .filter((mention) => mention.chunk === chunk)
    .sort((left, right) => left.start - right.start);
  let text = chunk.text;
  for (const { start, end } of spans) {
    text = text.slice(0, start) + " ".repeat(end - start) + text.slice(end);
  }
  return text;
}

/** Every prerequisite finding, for recognizers that mask all of them. */
export function prerequisiteFindings(
  prerequisites: ReadonlyMap<unknown, readonly Finding[]>,
): readonly Finding[] {
  return [...prerequisites.values()].flat();
}
