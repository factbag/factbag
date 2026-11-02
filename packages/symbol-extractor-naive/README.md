# Naive symbol extractor

`@factbag/symbol-extractor-naive` implements Jev's `ChunkSymbolExtractor` with
local, deterministic recognition. It makes no model or network calls and adds no
third-party runtime dependencies. The package exports `createChunkSymbolExtractor`
and its configuration type, `SymbolExtractorConfig`.

## Usage

Candidates are chosen by each requested field's type. Field names have no meaning,
and no per-field configuration is needed:

```ts
import { predicate } from "@factbag/core/dsl";
import { classifier } from "@factbag/jev";
import { createChunkSymbolExtractor } from "@factbag/symbol-extractor-naive";

class Person {
  constructor(readonly id: string) {}
}
const paid = predicate(
  "paid",
  { payer: Person, payee: Person, amount: Number, year: Number },
  { description: "The payer paid the payee the amount in the year." },
);

// corpus and input are your corpus and guarded knowledge base.
const run = classifier({
  corpus,
  input,
  createChunkSymbolExtractor: (chunks) =>
    createChunkSymbolExtractor(chunks, {
      entities: [[Person, (name) => new Person(name)]],
    }),
});
```

| Field type   | Candidates                                                                   |
| ------------ | ---------------------------------------------------------------------------- |
| `Date`       | Complete dates                                                               |
| `Number`     | Every figure, plus every year in an explicitly stated year range             |
| `String`     | Names, and aliases whose value is a string                                   |
| Entity class | Names passed through that class's factory, and aliases of exactly that class |

Every `Number` field receives the same figures: an amount field is also offered the
passage's years, ages, and percentages. Jev decides which combinations hold. This
keeps configuration minimal at the cost of more candidate facts per passage.

Both configuration properties are optional:

- `entities` lists one name factory per entity class. Entity fields without a
  factory receive only alias matches; Jev still offers registered entities.
- `aliases` lists known phrases and the values they denote:
  `{ text: "NY", value: new Location("new-york-state") }`. Each value is offered to
  fields of its own type. Repeat a phrase to keep alternative interpretations.

Invalid configuration, such as an empty alias phrase or a factory for a scalar type,
throws `TypeError` at construction. Jev validates every returned value against its
field type.

## Recognition

| Recognizer | Candidates                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------------ |
| `dates`    | Complete English month-name dates and ISO calendar dates, validated and returned at UTC midnight |
| `figures`  | Signed, grouped, and decimal figures without currency or percent signs: 40% becomes 40           |
| `aliases`  | Configured phrases, matched literally and case-sensitively at word boundaries                    |
| `names`    | Capitalized name-like phrases, excluding dates and configured alias phrases                      |

Year ranges support “from 1992 to 1993”, “between 1992 and 1993”, and dash forms
such as `1992–93`, for years from 1800 through 2199. Abbreviated endpoints use the
next matching year at or after the start: `1999–02` means 1999 through 2002.
Reversed ranges and unrelated years do not imply intervening years. Figures inside
dates are offered too, so “Feb 3, 1992” offers 3 and 1992 to `Number` fields.

## Execution and caching

Construction snapshots the configuration and source chunk list. The first query
for a field type runs the recognizers serving it, after their prerequisites: names
mask dates and aliases. Each recognizer runs at most once per extractor and sees
only its declared prerequisites' findings, so results do not depend on query order.

Recognizers are pure and synchronous. Scheduling, caching, and duplicate removal
live outside them. Numbers and dates are returned in ascending order. Queries return
fresh arrays and `Date` objects while retaining entity identities; entities are
created once per extractor. The factory controls identity: using names as IDs
merges equal names and separates different spellings.

## Limits

Name recognition uses capitalization and a small stop list, not a trained entity
recognizer. It can mistake institutions or sentence openers for people. The
extractor does not resolve pronouns, infer missing date components, recognize
unknown locations, or decide whether a proposition is true. Figures lose currency
units and are not converted between currencies.

Jev currently supplies one chunk per extractor. There is no hidden cross-document
registry. Supplying multiple chunks directly unions their candidates; Jev still
needs sufficient context to decide relationships.

## Checks

Each recognizer in `src/recognizers/` declares its prerequisites, scans a chunk,
states which field types it serves, and converts findings into field values. Shared
scanning helpers live in `src/recognizers/support/`. Tests sit next to each
recognizer and use the internal `src/testing/helpers.ts` harness, which runs a
recognizer with its prerequisites and compares its consolidated findings:

```ts
expectFindings("dates", "Born Feb 3, 1992.", [{ value: "1992-02-03", mentions: ["Feb 3, 1992"] }]);
```

Pass alias phrases as an optional fourth argument. The harness checks source spans
and freezes the chunk; the scheduler freezes the findings that later recognizers
share. Helpers are excluded from the package build.

```sh
pnpm --filter @factbag/symbol-extractor-naive test
pnpm --filter @factbag/symbol-extractor-naive typecheck
```
