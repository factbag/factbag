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

The statute covers §7703(a) and (b), §2(a) and (b), §151(b) and (c), and §152(b), (c) and
(d), each with its subparagraphs: 28 of the 88 citations in the train split, 56 of its 176
entailment cases. The remaining subsections, mostly about amounts (§1, §63, §68, §151(d))
and employment (§3306), are to be added in the same shape, then the numeric cases.

The household provisions rest on a derived-status layer: married under §7703 including the
living-apart rule of (b); surviving spouse from §2(a); head of household from §2(b); and
dependent from §152, as a qualifying child or qualifying relative with the exceptions of
(b). Three readings were settled against the train cases, since the statute alone does not
fix them: a qualifying child needs both dates of birth; "no income" for a qualifying
relative is the closed-world absence of any income; and §152(b)(1), which strips a
dependent of their own dependents, is triggered only by a dependency the text states or a
qualifying child, never by a derived qualifying relative, as otherwise a parent and the
child who is their stated dependent would each be the other's dependent. Exact days in the
text take precedence over a bare year for the same pair, since the classifier tends to
assert both.

The calendar is two fact tables, a year's first and last day and its first of July and
half-length in days, and the rules compare dates with `daysBetween` and `yearsBetween`
from the core DSL: more than half a year in the same home is the clipped stay's days
exceeding the half-length, and an age is the years between the close of the year and the
birthday.

Full covered run of 2026-10-23 (extraction `hh-2026-10-23`, Jev's default admission):
Factbag 56/56 at 47 requests, $0.0082 and a median 1.3 s per case
(`results/train-2026-10-23T04-31-41-708Z`); direct Jev 46/56 (82.1%, interval [71.4,
91.1]) at one request, $0.00005 and 107 ms per case
(`results/baseline-train-2026-10-23T04-32-52-921Z`). The ten disagreements are all
Factbag right, direct wrong, spread over §151(b), §152(c)(1), (c)(2), (d)(2)(D), §2(a) and
(b)(2), and §7703(b)(1); no case was answered by direct Jev alone. Fourteen of the 56
questions needed a reading request; the rest had one possible reading.

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
