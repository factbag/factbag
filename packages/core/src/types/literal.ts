import type { AnyAtom, Atom } from "./atom";
import type { EvidenceMetadata } from "./evidence-metadata";
import type { PredicateSchema } from "./schema";

/** Evidence polarity for an accepted literal. */
export type LiteralSign = "+" | "-";

/** A literal whose exact atom schema has been intentionally erased. */
export type AnyLiteral = Readonly<{
  sign: LiteralSign;
  atom: AnyAtom;
  metadata?: EvidenceMetadata;
}>;

/** Positive support for an atom. */
export type PositiveLiteral<Schema extends PredicateSchema = PredicateSchema> = Readonly<{
  sign: "+";
  atom: Atom<Schema>;
  metadata?: EvidenceMetadata;
}>;

/** Negative support for an atom. */
export type NegativeLiteral<Schema extends PredicateSchema = PredicateSchema> = Readonly<{
  sign: "-";
  atom: Atom<Schema>;
  metadata?: EvidenceMetadata;
}>;

/** A signed atom stored as explicit accepted evidence. */
export type Literal<Schema extends PredicateSchema = PredicateSchema> =
  | PositiveLiteral<Schema>
  | NegativeLiteral<Schema>;
