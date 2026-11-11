# SARA systems

Systems for the [SARA benchmark](../../benchmarks/sara), run with the
[eval runner](../../runner).

So far this package holds what the Factbag systems share and no system yet:

- `src/statute/`: the ruleset written from the statute, the fact vocabulary
  (`schema.ts`), and the registry of provisions a question can cite (`index.ts`).

The statute rules are one ruleset, written once from the statute text. Each predicate is
defined by one `iff`, with `or` for alternatives, so a false answer is a definite false and
sections may negate each other the way the statute says "unless". Only the text, question
and answer of each case are read; SARA's own Prolog facts and goals are never used.

```sh
pnpm --filter @factbag/sara-systems test
```

## Coverage

The statute covers every section SARA has: §7703, §2, §151, §152, §63, §68, §1, §3306 and
§3301, each with its subparagraphs: all 85 citations in the train split's entailment
cases, and all 176 cases. The twelve citations only the test split cites (§151(d)(1), (d)(3)(A),
(d)(5), §152(a), (d)(1)(D), §2(b)(1)(A)(i) with its subclauses (I) and (II), (A)(ii),
§63(c)(2)(A)(i), (ii) and (c)(6)(D)) are wired from the statute text, with their tests
written from its wording rather than from any case.

The couple's income given
as one figure ("Alice's and her spouse's gross income is $42,876") is its own fact, held
by whichever spouse the text states it for, and is the AGI of a joint return; two such
figures that disagree both stand, and the return then has no single tax. A death the text
places only in a year ("passed away at the end of 2010") is dated to the year's last day.
A group the text only counts ("each of her 87 employees") is not representable, and
"lived at Alice's place" is left to the classifier: the dataset encodes it as Alice
maintaining the household in one case and its "Alice's house" as not in another.

Questions come in two forms. A yes-or-no question asks whether a provision applies to the
people it names; a value question names an amount ("is equal to $4,000", "have to pay
$7,208", "equal to 22") and asks whether the provision's amount is that one. A provision
may have either form or both (§63(c)(5) and §68(b)(1)(A) have both); for a provision with
both, whatever reads the question chooses between them. The amount sits in the query atom, so
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

The calendar is arithmetic, in `src/statute/helpers/calendar.ts`: a year's first and last day, its first
of July and its half-length in days come from `firstOfMonth` in the core DSL, and the year
a date falls in from `yearOf`. The rules compare dates with `daysBetween` and
`yearsBetween`: more than half a year in the same home is the clipped stay's days
exceeding the half-length, and an age is the years between the close of the year and the
birthday.
