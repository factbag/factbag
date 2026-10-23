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
   registry in `src/statute/index.ts`, which fixes the predicate and its roles. The people
   and years the question names give every assignment of people to roles; with one
   assignment no request is made, otherwise Jev picks one in a single choice question.
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
pnpm --filter @factbag/sara-eval baseline --data /path/to/sara --compare results/train-<stamp>.jsonl
pnpm --filter @factbag/sara-eval probe --longest 10 --data /path/to/sara
```

Cases whose citation the statute does not yet cover, and the numeric cases, are listed in
the summary and cost no requests. Per-case records, including every admitted fact and the
query atom, go to a JSONL file under `results/` beside a summary. The test split is not
run until a configuration is frozen; descriptions and rules are tuned on train only.

`baseline` is the control: one Jev request per case carrying the statute section and the
scenario with a two-way Entailment/Contradiction question, no knowledge base or rules.
Its prompt is frozen (`PROMPT_VERSION` in `src/baseline.ts`). Frozen baseline of
2026-10-22 (extraction `probe-4-2026-10-22`, Jev's default admission) on the twenty covered
train cases: Factbag 20/20 at 37 requests and $0.0027 per case
(`results/train-2026-10-23T03-11-00-990Z`), direct Jev 16/20 at one request and $0.00005
per case (`results/baseline-train-2026-10-23T03-11-28-322Z`); every direct miss is a
negative case answered Entailment. `probe` grounds chosen cases and prints every admitted
fact for checking against the text, and `score-probe` scores a probe file against the
hand-written gold in `src/probe-gold.ts`; both read nothing but the train split.

## Coverage

The statute covers §7703(a)(1) and (a)(2), §2(a)(1)(A), (a)(2)(A), (a)(2)(B), (b)(2)(A),
(b)(2)(B), (b)(2)(C), §152(c)(2), (c)(2)(A), (c)(2)(B), (c)(3), and §152(d)(2) with all
eight relationships (A) to (H). The remaining subsections are to be added in the same shape.

§152(d)(2) was the first provision added under a reservation: its train citations (B) and
(E) were the development cases, (D) and (F) were reserved unread until the rules, the
reader and extraction `d2-2026-10-22` were frozen, then both systems ran once on them
(`results/train-2026-10-23T03-23-11-265Z`, `results/baseline-train-2026-10-23T03-23-11-884Z`).
Development and regression: 24/24. Reserved: Factbag 3/4 and direct Jev 3/4, both missing
`s152_d_2_D_pos`, where a stepmother is given as the spouse of the father rather than named
as a stepmother; the (D) rule read only a stated step relation, and the question reader
also swapped the two roles on that case. Those cases are no longer reserved. Both causes
were then fixed: a stepparent is now also derived as the spouse of a parent, and the
question reader became the choice question described above (the earlier per-candidate
classification had denied both orderings on some two-person questions). All 28 covered
train cases pass (`results/train-2026-10-23T03-40-07-660Z`).
