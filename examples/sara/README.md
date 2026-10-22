# SARA eval

An evaluation of Factbag on SARA, the StAtutory Reasoning Assessment (Holzenberger,
Blair-Stanek and Van Durme, 2020), which pairs short case descriptions with questions
about nine sections of the US Internal Revenue Code. Each entailment case asks whether a
cited subsection applies to the people and year it names. The dataset is MIT licensed and
is not vendored: pass the extracted `sara/` directory, which holds `cases/` and `splits/`,
with `--data`, or set `FACTBAG_DATA_DIR` so it is found at `$FACTBAG_DATA_DIR/sara`.

## What is being tested

One ruleset, written once from the statute text, applied to facts that Jev reads out of
each case. The pipeline for a case is:

1. **Mentions** (`src/mentions.ts`): regular expressions list the people named, the
   dates written out and the years in the text and the question. These are the finite
   domains Jev's candidates range over; nothing here decides what is true.
2. **Grounding** (`src/ground.ts`): a fresh knowledge base holding the statute's rules
   and a calendar, the people as entities, and whatever the Jev classifier asserts or
   denies over the fact vocabulary in `src/schema.ts`: marriages, decrees, deaths, births,
   nonresident alien status, parent and sibling relationships. Dates are plain `Date`
   fields, enumerated from the dates the text mentions.
3. **Question reading** (`src/question.ts`): the citation picks the provision from the
   registry in `src/statute/index.ts`, which fixes the predicate and its roles. Jev reads
   the question to say which named person fills which role and which year is asked about.
4. **Query**: the statute decides. A true answer is Entailment, a false one Contradiction;
   anything else is unanswered and scores as wrong.

The statute rules live in `src/statute/`. Each predicate is defined by one `iff`, with
`or` for alternatives, so a false answer is a definite false and sections may negate each
other the way the statute says "unless". Only the text, question and answer of each case
are read; SARA's own Prolog facts and goals are never used.

## Running

```sh
pnpm --filter @factbag/sara-eval test
pnpm --filter @factbag/sara-eval eval --split train --data /path/to/sara
pnpm --filter @factbag/sara-eval eval --split train --citation "2(a)(1)(A),7703(a)(2)"
```

Cases whose citation the statute does not yet cover, and the numeric cases, are listed in
the summary and cost no requests. Per-case records, including every admitted fact and the
query atom, go to a JSONL file under `results/` beside a summary. The test split is not
run until a configuration is frozen; descriptions and rules are tuned on train only.

## Coverage

The statute currently covers §7703(a)(1) and (a)(2), §2(a)(1)(A), (a)(2)(A), (a)(2)(B),
(b)(2)(A), (b)(2)(B), (b)(2)(C), and §152(c)(2), (c)(2)(A), (c)(2)(B), (c)(3): the twenty
train cases that cite them all pass. The remaining subsections are to be added in the
same shape.
