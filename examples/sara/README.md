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
pnpm --filter @factbag/sara-eval eval --split train --numeric --data /path/to/sara
pnpm --filter @factbag/sara-eval baseline --data /path/to/sara --compare results/train-<stamp>.jsonl
pnpm --filter @factbag/sara-eval replay --facts results/train-<stamp>.jsonl --data /path/to/sara
pnpm --filter @factbag/sara-eval trace --facts results/train-<stamp>.jsonl --case tax_case_12
pnpm --filter @factbag/sara-eval probe --longest 10 --data /path/to/sara
```

Extraction is staged (see Staged extraction below); there is no other strategy, and
result files are named `<split>-staged-<stamp>`. Cases whose citation the statute does
not cover are listed in the summary and cost no requests; `--numeric` and `--entailment`
run one kind of case only. Per-case records,
including every admitted fact and the query atom, go to a JSONL file under `results/`
beside a summary. A case with no prediction carries its failure's category, and the
summary tallies them: `question unreadable: no year named` (or no amount, or too few
people), `query: unknown`, `query: no amount`, `query: several amounts`, and `error`. An
unreadable question is never answered Contradiction. Each record also lists the fact
predicates the grounding skipped because the text offered no candidate for one of their
fields (no date, no amount, fewer people than the predicate names), and the summary counts
how many cases skipped each. The test split is not run until a configuration is frozen;
descriptions and rules are tuned on train only.

`replay` re-solves a saved run's facts under the current rules with no requests; given the
data directory it also reads again, offline, any question the run left unread or whose
query threw, when only one reading is possible. `trace` rebuilds one saved case and prints
what every intermediate predicate makes of it, for each person and the case's year: the
marital statuses, dependents, gross income, exemptions, deductions, taxable income, the
§1 tax, employer status, wages and the tax owed. A wrong amount is then laid at the
extraction's door or at a rule's in a minute, which is how the numeric misses below were
attributed.

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
cases, all 176 cases, and the 80 numeric cases, which ask how much tax a person has to
pay in a year. The twelve citations that only the test split cites (§151(d)(1), (d)(3)(A),
(d)(5), §152(a), (d)(1)(D), §2(b)(1)(A)(i) with its subclauses (I) and (II), (A)(ii),
§63(c)(2)(A)(i), (ii) and (c)(6)(D)) were wired after the first test run, from the statute
text and the reference formalization, with their tests written from the statute's wording
rather than from any case; `notes/sara/2026-10-24-test-coverage.md` records the readings
taken and where they part from the reference. Two of them have no year in their questions
and stay unreadable, as the note explains; the second test run scores the rest.

A numeric question is read like a value question with the amount left open: the query
`tax_owed(taxpayer, year, Amount)` is solved for every amount it supports, and the case
is answered when exactly one is. The tax owed is the income tax of §1 on taxable income
under §63, with the exemptions of §151 and the limitation of §68, plus the unemployment
tax of §3301; a joint return sums the spouses' incomes and exemptions, as the reference
formalization does. The answer is scored by exact match, with the distance to the gold
amount recorded and the counts within a dollar and within one percent reported beside it,
since SARA's own tolerance for numeric answers is not documented here. Ten numeric train
cases are statute tests (their texts written down as facts); the solver answers the
eight-person one, `tax_case_10`, in about a quarter of a second. The couple's income given
as one figure ("Alice's and her spouse's gross income is $42,876") is its own fact, held
by whichever spouse the text states it for, and is the AGI of a joint return; two such
figures that disagree both stand, and the return then has no single tax. A death the text
places only in a year ("passed away at the end of 2010") is dated to the year's last day.
A group the text only counts ("each of her 87 employees") is not representable, and
"lived at Alice's place" is left to the classifier: the dataset encodes it as Alice
maintaining the household in one case and its "Alice's house" as not in another.

The candidate scanner (`src/mentions.ts`) reports what is explicitly in the text and
nothing more. It finds capitalised words as names, less the months and the function words
that open a sentence, so a capitalised place or institution is taken for a person, and a
run of adjacent capitalised words, with a roman numeral allowed at the end, is one name
("Johns Hopkins University", "Walter Brown Family Trust II"); complete dates; four-digit
years, on their own, inside a date, or within a range the text states as one ("from 2004
to 2019", "between 2004 and 2019", "the years 2015 through 2020" offer every year in the
range, and Jev judges each year's facts on the text); and dollar amounts, percentages,
ages and the figure after "equal to", each with the span of every occurrence. It does not
resolve identity or relationship: "her spouse", "their son" and "her daughter" make no
entity, and a person the text never names takes no part in the facts. It does not give a
day its year from elsewhere in the passage ("On November 25th, Bob died" yields no date),
and it does not fill in the years between two the text does not join ("in 2015 and in
2019" offers those two). The question reader likewise takes the year from the question or reports
the question unreadable; the mistyped "How much tax does Alice have to pay in 356472?" is
therefore unanswered. These are deliberate limits, measured rather than papered over: the
earlier heuristics that did each of these things are removed, and the runs under each
scanner are kept side by side under Results. Note what the limits do under the closed
world: a fact predicate skipped for want of candidates is not merely unknown, since the
rules read a closed predicate's absence as falsity, so a spouse the text leaves unnamed
leaves the taxpayer unmarried, and a year the text does not name is a year in which
nothing happened. Incomplete discovery therefore moves answers, not only coverage, and the
simplification does not solve that; it makes it visible.

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
Payments are rows that keep their day, so twelve payments of $550 on twelve days are
twelve payments and not one; wages are the payments for the employment less what is not
remuneration for the service, a payment on termination for death or retirement for
disability, the causes (b)(10) names, or into a plan for sickness, accident disability or
death under (b)(2), while a bonus on an ordinary retirement and money put into a
retirement fund stay wages, which is what the gold amounts of `tax_case_26`, `_32`,
`_47` and `_94` require. The employer tests of (a) sum the payments of their kind over the
year and the year before, as the reference does (its (a)(2)(A) sums the year although the
text says "any calendar quarter"). The ten-days-in-ten-weeks tests count Monday-start
weeks from a fixed Monday with `floorTo(div(daysBetween(day, monday), 7), 0)`, so no week
table is needed; and the preceding year is reached by arithmetic rather than by
enumerating the calendar, which had cost half a second a query.

Gross income is the stated figure plus the payments the person received in the year, as
the reference's `gross_income` sums it: a father paid $2,561 by his daughter has that
income and is not her dependent (`tax_case_72`). A payment whose amount the text also
states as income counts once, and money paid into a plan or insurance for someone is not
paid to them. On a joint return the exemptions are each spouse's own and one for each
dependent of either, a dependent of both counted once; the reference sums the two
spouses' lists.

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
without defining a §152 dependency, as in the reference. A year-only statement of a
shared home stands for the whole year, as the dataset encodes it, and yields to exact days
for the same pair as the finer statement of the same stay; this is the one precedence
between two true facts the rules keep. Gross income is the stated amounts plus the
payments received, as the reference sums them, with no attempt to tell whether a payment
and a stated income are the same money.

Two further places where the rules follow the statute and the reference does not, kept as
they are and reported here:

- _Stepchildren, §152(f)(1)(B)._ The statute treats a stepchild as a child for the
  relationships of (c)(2) and (d)(2); the reference's child relation is built from the
  stated son, daughter, father and mother events alone and derives no step relation (it
  does derive stepsiblings). The rules derive the stepchild. On a joint return the
  difference vanishes, since each dependent is counted once whichever spouse qualifies.
- _Agricultural labor abroad, §3306(c)(1)._ In `tax_case_51` an American employer pays a
  citizen $23,200 for agricultural labor in Venezuela: service abroad under (c)(B), and
  employment since the $20,000 test of (c)(1)(A)(i) is met. The gold amount has no
  unemployment tax. In the reference the (c)(1)(A) test is guarded by `nonvar(Caly)` and
  the wages path calls it with the year unbound, so the exception for agricultural labor
  applies there and the labor is not employment; the same text with the labor in the
  United States would be employment on both readings.

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

Full train run of 2026-10-23 (extraction `em-2026-10-23`, Jev's default admission), all
176 entailment cases: Factbag 170/176 (96.6%, interval [93.8, 98.9]) at 64 requests,
$0.0095 and a median 1.4 s per case, 28 ms of it in the solver
(`results/train-2026-10-23T22-54-41-918Z`); direct Jev 143/176 (81.3%, [75.6, 86.9]) at one
request, $0.00007 and 83 ms per case (`results/baseline-train-2026-10-23T22-55-39-767Z`).
Factbag alone was right on 32 cases, direct Jev alone on 5, neither on 1. The six Factbag
misses, each attributed by replaying its saved facts:

- `s152_b_1_pos`: the known semantic disagreement above.
- `s151_a_pos`: "one exemption of $2000 … under section 151(c)" was also read as the
  §151 total. Extraction; the kind's instruction now excludes amounts the text puts under
  151(c) or (d), and the case passed on a rerun.
- `s63_c_1_pos`, `s63_a_pos`: "$2000" was read as the year 2000 by the mention scanner,
  which then offered every year from 2000 to 2017 as a candidate, and the classifier
  scattered the stated amounts over them. Dollar amounts are no longer years. `s63_a_pos`
  also tripped a solver assertion on those facts (an `or` judged under an environment its
  branches only extended, fixed in core with a test that reproduces it without the
  statute); the run now keeps the facts of a case whose query threw, so such a case can be
  replayed.
- `s63_c_3_pos`: "an additional standard deduction of $600 each for herself and for Bob":
  the classifier offers no candidate with one person in two fields, so Alice's own §63(f)
  amount could not be a fact. It is now its own predicate.
- `s3306_b_15_pos`: "On November 25th, Bob died" gives no year, and the text names
  several; a day without a year then took the year of the nearest full date before it, a
  rule since removed (see the scanner's boundary above and the results below).

Rerunning the five affected citations after these fixes: 9/10, with `s151_a_pos` fixed by
the later instruction (`results/train-2026-10-23T23-00-56-481Z`). Replaying the full run's
facts under the rules as now committed, including the employment and gross income changes
below, is unchanged at 170/176 (`results/replay-2026-10-23T23-48-56-392Z`).

The 80 numeric train cases ran the same day (`results/train-2026-10-23T23-05-28-637Z`; a
first run had answered none, since the question reader demanded a named amount even for
the open question): 54/80 exact (67.5%, [57.5, 77.5]), 58 within one percent, at 107
requests, $0.035 and a median 2.8 s per case, 114 ms in the solver; the eight-person case
took 539 requests. Replaying its facts under the rules as now committed gives 58/80
(`results/replay-2026-10-23T23-47-26-530Z`): the wage rows, the non-remuneration
payments, payments as gross income, plan money and the missing-year question account for
`tax_case_26`, `_32`, `_47`, `_71`, `_72` and `_94`. The 22 remaining misses, by cause:

- Extraction, 12: an amount attached to the wrong person ("Alice earned $65400 and Bob
  earned $56400" gives Bob both; `_2`, `_73`), a marriage invented between the payer and
  a survivor (`_12`), a payment read as an itemized deduction and the applicable amount
  (`_20`), a charitable or itemized deduction read as a §151 exemption (`_6`, `_92`), a
  joint return asserted for one spouse only (`_21`), a $200 payment with no payer missed
  (`_74`), 68 payments read off twelve lists of initials that hold 57 (`_83`), and
  spurious relations among eight people (`_10`). The two exemption misreadings have
  sharper instructions now, unverified.
- Vocabulary, 9: an unnamed spouse with the couple's income given as one figure (`_29`,
  `_50`, `_58`, `_60`, `_91`), a marriage with an unnamed spouse that leaves the person
  single (`_67`, `_70`), an unnamed daughter (`_20`), two named people's income given as
  one figure (`_62`), a death placed only in a year (`_88`), and "lived at Alice's place"
  (`_22`). All but the 87 counted employees of `_33` are now representable, as described
  under Coverage, and wait for an extraction run.
- Disagreement with the reference, 1: `_51`, above.

The direct baseline has no numeric form: the SDK's question types are choice, yes-or-no
and score, none of them a free number.

Rerunning everything on 2026-10-24 with the vocabulary above (extraction `nr-2026-10-24`):
the 176 entailment cases give Factbag 175/176 (99.4%, interval [98.3, 100]) at $0.0090
and a median 1.7 s per case, 46 ms of it in the solver
(`results/train-2026-10-24T00-54-20-524Z`), against direct Jev 144/176 (81.8%, [76.1, 87.5],
`results/baseline-train-2026-10-24T00-37-01-646Z`); Factbag alone is right on 32 cases,
direct Jev alone on `s152_b_1_pos`, neither on none. The 80 numeric cases give 67/80 exact
(83.8%, [75.0, 91.3]), 71 within one percent, one unanswered, at $0.040 and a median 3.3 s
per case, 155 ms in the solver (`results/train-2026-10-24T00-54-31-152Z`; two earlier runs
of the day under intermediate vocabulary, 67/80 and 62/80, are kept beside it). Of the 13
misses, ten are extraction (an amount or a marriage given to the wrong person, a figure
read as two kinds of amount, the lists of initials), two are the counted employees of
`tax_case_33` and the "Alice's place" of `tax_case_22`, which the dataset encodes as
maintaining the household where `tax_case_64`'s "Alice's house" is not, and one is the
`tax_case_51` disagreement. The ledger of every run, rerun and replay, with each miss
attributed, is in `notes/sara/`.

Those numbers are the bespoke checkpoint. The scanner was then cut back to what the text
states explicitly, as described under Coverage, and the rules that resolved two facts by
presumed classifier reliability were removed (the joint-figure preference, the equal-amount
exclusions from gross income, the remarriage reading); `notes/sara/2026-10-24-explicit-scanner.md`
lists every removal and retention. Live full runs under that scanner (extraction
`explicit-2026-10-24`): entailment 169/176 (96.0%, [92.6, 98.9]) at $0.0104 and a median
1.9 s per case (`results/train-2026-10-24T01-25-59-628Z`), against the checkpoint's 175/176
and direct Jev's 144/176; numeric 56/80 (70.0%, [60.0, 80.0]), one unreadable question, at
$0.030 and 3.0 s (`results/train-2026-10-24T01-25-42-829Z`), against 67/80. Replaying the
checkpoint's saved facts under the new rules alone gives 175/176 and 62/80
(`results/replay-2026-10-24T01-17-44-878Z`, `results/replay-2026-10-24T01-18-12-333Z`), so
the rules cost five numeric cases and the scanner the rest. The six new entailment misses
are four questions about a year inside a stated range ("from 2004 to 2019", asked about
2018), one list of occasions dated without a year, and one death dated without a year; the
numeric losses are the unnamed spouse (seven cases) and a stated income counted again as
the payment it describes (seven). Two runs cut off by the account's credits are kept as
partial files and are not results. Each change to the rules is a statute test first: 88
tests, whose facts are the train texts written down, run in under 20 s.

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

After the test split's second round, the scanner was given one more thing the text states:
every year of a range it writes as one ("from 2004 to 2019" offers 2004 through 2019), with
Jev still judging each year's facts; nothing is filled in between two years the text does
not join. Under that scanner, with staged extraction as the only strategy, train entailment
is 173/176 (98.3%, [96.0, 100]) at $0.0049 and 0.81 s per case
(`results/train-staged-2026-10-24T17-30-52-617Z`): the five range cases moved to the gold
and nothing moved the other way; the three misses left are the two days without a year and
`s152_b_1_pos`. `notes/sara/2026-10-24-year-ranges.md` has the paired comparison and cost.

## The test split

Run once on 2026-10-24 under the configuration of commit `e8ee1d5`, after the staged
filter's development comparison and on the user's authorization; nothing was changed
after reading it, and the baseline script was fixed to load the split it was asked for.
The split has 100 entailment cases on citations disjoint from the train split's and 20
numeric cases. The statute wires 76 of the 100; the 24 others cite twelve provisions
nobody wired (§151(d)(1), (d)(3)(A), (d)(5), §152(a), (d)(1)(D), §2(b)(1)(A)(i) and its
subclauses, (A)(ii), §63(c)(2)(A)(i), (ii), (c)(6)(D)) and count as wrong. On the 76:
exhaustive 72 (94.7%, [89.5, 98.7]) at $0.0112 and 1.8 s per case
(`results/test-exhaustive-2026-10-24T02-13-12-121Z`), staged 72, the same four misses, at
$0.0040 and 0.76 s (`results/test-staged-2026-10-24T02-12-43-164Z`), direct Jev 68 (89.5%,
[81.6, 96.1]; `results/baseline-test-2026-10-24T02-14-14-336Z`); paired, Factbag alone is
right on 6, direct alone on 2, neither on 2. Over all 100: 72. Numeric: exhaustive 13/20,
staged 12/20, both 14 within one percent
(`results/test-exhaustive-2026-10-24T02-13-37-100Z`,
`results/test-staged-2026-10-24T02-13-31-699Z`). Every miss is attributed in
`notes/sara/2026-10-24-test-split.md`: two vocabulary gaps and two scanner limits on
entailment; the unnamed spouse, the unlisted year, two extraction errors, one vocabulary
gap and one semantic disagreement on the numeric cases.

A second round was run on 2026-10-24 under commit `e1b5cc4`, on the user's authorization,
with every test citation wired (see Coverage) and the change list declared beforehand in
`notes/sara/2026-10-24-test-coverage.md`. Over all 100 entailment cases: exhaustive 88
(88.0%, [81.0, 94.0]) at $0.0130 and 1.75 s per case
(`results/test-exhaustive-2026-10-24T16-52-56-806Z`), staged 88 with the same answers on
every case at $0.0054 and 0.76 s (`results/test-staged-2026-10-24T16-52-32-329Z`), direct
Jev on all 100 85 (85.0%, [78.0, 92.0]; `results/baseline-test-2026-10-24T16-51-47-115Z`);
paired, Factbag alone is right on 13, direct alone on 10, neither on 2. The 76 cases of
the first round gave the same 72, miss for miss; the 24 new ones gave 16, with four
questions unreadable for want of a year and four wrong. Numeric: exhaustive 13/20, staged
12/20, the first round's misses exactly
(`results/test-exhaustive-2026-10-24T16-52-16-603Z`,
`results/test-staged-2026-10-24T16-52-03-040Z`). Every miss is attributed in
`notes/sara/2026-10-24-test-round-two.md`: the four new wrong answers are a year inside a
stated range twice, a stated §152(b)(2) status the vocabulary lacks, and the (b)(1)
mutual-pair reading on a two-person text with no income. The direct baseline moved by four
cases between its two runs on identical inputs; the pipeline's answers did not move.

A third evaluation, on the user's authorization and labelled as one made after development
changes, ran the 100 entailment cases once under commit `8bc39b2` (staged extraction as
the only strategy, every year of a stated range a candidate): 90 (90.0%, [84.0, 95.0]) at
$0.0084 and 0.68 s per case (`results/test-staged-2026-10-24T17-44-37-734Z`). The two
cases the second round attributed to a year inside a range moved to the gold and nothing
else moved; the four year-less questions stay unreadable and the six other misses are the
second round's. The numeric cases and the direct baseline were not rerun. See
`notes/sara/2026-10-24-test-round-three.md`.

## Staged extraction

Extraction filters predicates, then role values, before the same final
ASSERT/DENY/IRRELEVANT classification. This is the evaluator's only strategy since
2026-10-24: on the test split's second round the staged filter gave the same answer as
exhaustive classification on every one of the 100 entailment cases at 36% of the requests,
and on train it was within one case (168/176 against 169/176). The exhaustive execution
path and its `--strategy` switch were removed from this example; the library's exhaustive
classifier (`@factbag/jev/classifier`) is unchanged, and the exhaustive runs under
`results/` (`train-<stamp>`, `test-exhaustive-<stamp>`) are kept as the record they were.
The scanner, candidate source domains, statute rules, question reader and admission
threshold are the same under either.

Routing defaults are `--relevance-threshold 0.3`, `--participant-threshold 0.3`, and
`--candidate-product-cutoff 16`, the development settings the filter was ported with and
unchanged since. The cutoff skips participant filtering for small Cartesian products;
Boolean values are never participant-filtered. These are initial experimental settings,
not calibrated confidence guarantees. Negative evidence counts as relevant in both routing
passes. Only the final classifier writes facts.

Both routing passes use the same metered SDK/model as classification, so reported
cost includes filtering. Each JSONL record contains a `routing` audit: predicate and
role/value decisions, probabilities, retained flags, candidate products, bypass reasons,
and request/question counts by stage. `unclassified` still means missing candidate
domains, not predicates rejected by routing. Summaries name the strategy; saved runs
without a strategy field are exhaustive.

To compare two saved runs on the same cases, including paired answer changes and lost
admitted facts, rather than only total accuracy (paths relative to this example):

```sh
pnpm --filter @factbag/sara-eval compare-strategies --baseline results/train-2026-10-24T01-25-59-628Z.jsonl --candidate results/train-staged-2026-10-24T01-44-36-342Z.jsonl
```

Saved facts are a baseline for comparison, not gold extraction annotations. Stage filtering
can remove evidence and thereby change a closed-world answer even when no error is raised.

The first staged development run scored 168/176 versus 169/176 exhaustive, with 62.7%
lower estimated API cost. See `notes/sara/2026-10-24-staged-filter.md` at the workspace
root for the paired results, evidence losses, and attribution of the one changed answer.
