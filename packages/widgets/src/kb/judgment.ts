/**
 * Package-internal helpers for walking a Judgment's supports. Deliberately not
 * exported from the package: consumers own their judgment-walking (@factbag/docs
 * keeps its own copy — the docs teach by showing the walk in full).
 */
import type { Judgment } from "@factbag/core/query";

export type AnySupport = NonNullable<Judgment["positive"]>[number];

export function supportsOf(judgment: Judgment): readonly AnySupport[] {
  return [
    ...(judgment.positive ?? []),
    ...(judgment.negative ?? []),
    ...(judgment.inconclusive ?? []),
  ];
}
