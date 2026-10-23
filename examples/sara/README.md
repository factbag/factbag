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
pnpm --filter @factbag/sara-eval replay --facts results/train-<stamp>.jsonl
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

The statute covers every section SARA has: §7703, §2, §151, §152, §63, §68, §1, §3306 and
§3301, each with its subparagraphs: all 85 citations in the train split's entailment
cases, all 176 cases. The numeric cases come next.

Questions come in two forms. A yes-or-no question asks whether a provision applies to the
people it names; a value question names an amount ("is equal to $4,000", "have to pay
$7,208", "equal to 22") and asks whether the provision's amount is that one. A provision
may have either form or both (§63(c)(5) and §68(b)(1)(A) have both), and the reader picks
the valued form when the question names an amount. The amount sits in the query atom, so
the solver's constraint on an already bound `letIn` variable does the comparison; the
rules round as the reference does, to whole dollars with halves away from zero, and the
percentage rules keep to whole-number arithmetic so that a half never meets a float.

Employment, §3306 and §3301, is the text's facts about pairs of people: who employed whom
and for what kind of work (agricultural labor, domestic service, or neither), where, what
was paid, when and in what medium, payments into plans and on termination, and the few
states of a person that take service out of employment (a student at the employing
school, a hospital's patient, a person committed to a penal institution, a relative). An
undated payment is dated to the end of the work, as the reference formalization dates it.
The ten-days-in-ten-weeks tests count Monday-start weeks from a fixed Monday with
`floorTo(div(daysBetween(day, monday), 7), 0)`, so no week table is needed; and the
preceding year is reached by arithmetic rather than by enumerating the calendar, which
had cost half a second a query.

The amounts rest on stated figures where the text gives them and on the derivations
otherwise: an amount the text states by naming its section (an exemption under §151(c),
a basic standard deduction under §63(c)(2), an itemized deduction, the applicable amount
of §68(b), and so on) is one fact predicate with a kind, and each rule prefers the stated
figure to its own derivation of it. Taxable income is the stated figure, or §63(b) for
one who does not itemize and §63(a) for one who does; §1's twenty brackets are each a
predicate, since a question may ask about one bracket and is answered no when the income
falls in another.

The household provisions rest on a derived-status layer: married under §7703 including the
living-apart rule of (b); surviving spouse from §2(a); head of household from §2(b); and
dependent from §152, as a qualifying child or qualifying relative with the exceptions of
(b). The rules are authored from the statute text; where the text leaves a reading open,
the reference formalization that ships with SARA (`statutes/prolog/`, read but never run,
with the held-out cases' facts and answers left unread) settles it, and the train cases'
own fact encodings show how the authors meant their sentences. Three readings were checked
this way:

- _Dates of birth, §152(c)(3)._ The reference needs the child's date of birth, or it cannot
  be under 25; when the taxpayer's is missing it takes a descendant of the taxpayer to be
  the younger. The rules do the same: a child of unknown age is not a qualifying child
  (though they may be a qualifying relative), and a parent of unknown age is older than
  their child.
- _No income, §152(d)(1)(B)._ The reference sums the income it finds, so none stated is
  none; the case that says "did not have any income" states no income facts, exactly like
  the cases that say nothing. Absence is zero.
- _Dependents' dependents, §152(b)(1)._ The reference tests whether the taxpayer is
  someone's dependent as a qualifying child or a qualifying relative, derived or not, and
  when it does so it does not test in turn whether that someone is a dependent: the
  recursion stops one level down. The rules do the same, which also keeps them stratified
  (the solver rejects recursion through negation). A pair who each qualify as the other's
  dependent, such as a child and a parent with no stated income, therefore leaves neither a
  dependent, as it does in the reference. An earlier shortcut that let only stated
  dependencies and qualifying children trigger (b)(1) is gone.

One train case disagrees with these semantics: `s152_b_1_pos`, "Alice has a son, Bob, who
satisfies section 152(c)(1)…", expects Bob to be a dependent. Its reference facts hold the
two stated qualifying-child relations and nothing else; the text's "has a son" relations,
which the extraction asserts, make Alice, with no stated income, a qualifying relative of
her son and grandson under (d)(2)(C), so Alice and Bob each defeat the other under (b)(1).
The reference gives the same answer on those facts. The case is kept as a known failure
rather than special-cased; §7703(b)(1) follows the reference in reading the deductible
child as a qualifying child, and a stated §151(c) deduction satisfies §151(c) directly
without defining a §152 dependency, as in the reference. Exact days in the text take
precedence over a bare year for the same pair, since the classifier tends to assert both.

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

Replaying that run's saved facts and question readings under the reference-checked rules
(`pnpm --filter @factbag/sara-eval replay --facts results/train-2026-10-23T04-31-41-708Z.jsonl`,
no requests) gives 55/56: only `s152_b_1_pos` changes, as described above
(`results/replay-2026-10-23T14-15-54-569Z`). The solver's share of a case is a median 27 ms
and at most 110 ms, against the 1.3 s median end to end; the rest is the classifier.
A fresh extraction run on these rules, and the first run of the amounts family, wait on
the TypeSafe account's credits; the amounts and employment families are so far exercised by the
statute tests, whose facts are the train texts written down (57 tests, under 7 s).

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
