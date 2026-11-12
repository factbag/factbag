# SARA systems

Four systems for the [SARA benchmark](../../benchmarks/sara), run with the
[eval runner](../../runner). Together they are a two-by-two: Jev or a general LLM as the
reader, with or without the knowledge base.

|         | Model answers | Statute rules answer |
| ------- | ------------- | -------------------- |
| Jev     | `jev-direct`  | `jev-factbag`        |
| Any LLM | `llm-direct`  | `llm-factbag`        |

Each system is a directory of `src/`, named as `--system` takes it, and exports its
`SystemDefinition` from `system.ts`:

- `src/jev-factbag/`: Jev's classifier with the Clairic symbol extractor fills a knowledge
  base holding the statute's rules, and the rules decide.
- `src/jev-direct/`: the control: one Jev request per case carrying the cited section and
  the scenario, with no knowledge base, rules or query, so it measures what Factbag adds.
  Its prompt is frozen (`PROMPT_VERSION`) and tuned no further.
- `src/llm-factbag/`: a general LLM fills the same knowledge base through
  `@factbag/openai`'s tools and the same rules decide.
- `src/llm-direct/`: the LLM's control: one request per case carrying the cited section,
  the scenario and the statement, answered by the model.

What they share:

- `src/statute/`: the ruleset written from the statute, the fact vocabulary
  (`schema.ts`), the registry of provisions a question can cite, and the record a run
  keeps of each case with the `replay` and `trace` tools that read it. Both Factbag
  systems use it; the direct ones do not.
- `src/models/`: how the models are reached and priced: the conversation with a model over
  the Responses API or Chat Completions, the 429 retry and the list prices.
- `src/main.ts`: hands the benchmark and the four definitions to the runner's `main`.

## Running

```sh
pnpm --filter @factbag/sara-systems test
pnpm --filter @factbag/sara-systems eval --system jev-factbag --data /path/to/sara
pnpm --filter @factbag/sara-systems eval --system jev-direct
pnpm --filter @factbag/sara-systems eval --system llm-factbag --model <id> --input-price 1.25 --output-price 10
pnpm --filter @factbag/sara-systems eval --system llm-factbag --queries checked --model <id> --input-price 1.25 --output-price 10
pnpm --filter @factbag/sara-systems eval --system llm-direct --model <id> --input-price 1.25 --output-price 10
pnpm --filter @factbag/sara-systems eval --system jev-factbag --tag "citation=2(a)(1)(A),7703(a)(2)"
pnpm --filter @factbag/sara-systems eval --system jev-factbag --cases tax_case_12,s151_a_pos
pnpm --filter @factbag/sara-systems replay --facts results/<run>.jsonl
pnpm --filter @factbag/sara-systems trace --facts results/<run>.jsonl --case s151_a_pos
```

`eval` runs the train split unless `--split test` is passed, and takes the runner's
flags (`--cases`, `--tag`, `--limit`, `--concurrency`, `--out`). The data defaults to
`$FACTBAG_DATA_DIR/sara`. A flag that the chosen system does not take is refused. Live runs
need `TYPESAFE_API_KEY` for Jev and, for `jev-factbag`, `CLOUDFLARE_ACCOUNT_ID` and
`CLOUDFLARE_API_TOKEN` for Clairic. Each case reports its usage of each model at list price
(`src/models/prices.ts`). The LLM systems call an
OpenAI-compatible endpoint with `fetch`: they need `OPENAI_API_KEY`, take
`OPENAI_BASE_URL` for an endpoint other than OpenAI's, and have no default model or price,
so pass `--model` and the model's list prices in USD per million tokens as `--input-price`
and `--output-price`. `--cached-input-price` prices the input the endpoint read from its
cache, which is most of a tool conversation; without it that input is priced as any other.
`--api responses|chat` picks the Responses API, the default, or Chat Completions, which
other providers serve; OpenAI's reasoning models take function tools through the Responses
API only. `--reasoning-effort` is passed to the model as given and becomes part of the
run's name. Over the Responses API the conversation is kept by the eval and sent whole
each turn with `store: false`. The test split is not run until a
configuration is frozen; descriptions and rules are tuned on train only.

For `jev-factbag`, routing takes `--predicate-threshold`, `--symbol-threshold` and
`--candidate-product-cutoff`, which default to Jev's and are validated by Jev; a run's
summary records Jev's full settings. A Clairic request that Workers AI turns away with 429
is retried up to four times, backing off from one second, before the case fails. A case
whose citation the statute does not cover is unanswered and costs no requests, and an
unreadable question is never answered Contradiction. Each case's record keeps every
admitted fact, the people, the query atom and its value, or why the question went unread.

`replay` re-solves the facts of a saved `jev-factbag` or `llm-factbag` run and question readings under the current
rules with no requests, and reports which answers changed; a case whose question went
unread stays unanswered. `trace` rebuilds one saved case and prints what every
intermediate predicate makes of it, for each person and the case's year, so a wrong
answer can be laid at the extraction's door or at a rule's.

## The LLM systems

`llm-factbag` gives the model the scenario, the statement and the knowledge base's tool, and not
the statute. The one tool, `knowledge_base`, runs an operation per call: `add` on `person`, `assert`
or `deny` on a predicate of the fact vocabulary, and `query` on the cited provision. Its
description lists each of those names once.
Its definition is about 87,000 characters in every request, nearly all of it the
vocabulary's descriptions. The model registers the people, asserts what the
scenario states and queries the statement; the eval runs each tool call and sends back its
result, including mistakes the model can fix. The answer is the value of a query, never
the model's text. A model that never queries leaves the case unanswered, and a conversation
is cut off after 16 model turns. Facts are closed, so what is not asserted is already
false; the deny operations are there because a model that reads "Alice is not married"
and has only assert to hand asserts the marriage.

A fact the model both asserted and denied is settled after the conversation, the way
`@factbag/jev`'s `resolver` settles one. Each contradiction is one further request, apart
from the conversation, that shows the scenario, the fact and every record of it with the
reason the model gave, and asks of each record KEEP or RETRACT. Retracted records are
taken out, and the statute is asked again over what stands. Keeping is the default, so a
contradiction the model does not judge stays, and the case is unanswered. The model
judges its records, never the statement. `jev-factbag` runs Jev's resolver at the same
point, after grounding, though a case is one passage and seldom leaves it anything to settle.

`--queries` says what the model learns of its query:

- `once`, the default: the conversation ends at the first query. The model is not told the
  value, so it cannot revise its facts to change it. This measures the model as a reader.
- `checked`: the model is told each query's value and its explanation, cut to the 20
  claims that decided it. It may record a fact it missed and query again, and the last
  query is the answer. This is the loop an agent built on Factbag would run. Nothing can
  be taken back, so a fact recorded wrongly stays. Its runs are named
  `llm-factbag-checked-<model>`.

Each case's record has the same shape as `jev-factbag`'s, so `replay` and `trace`
read an `llm-factbag` run too, and adds the model turns, queries, output tokens, cached
input tokens, tool errors, and the contradictions found and records retracted. Spend
counts output tokens, which the runner's per-model `inputTokens` does not show.

`llm-direct` asks for reasoning followed by a final line that is exactly `Entailment` or
`Contradiction`, and takes the last label the reply names.

The prompts are frozen (`PROMPT_VERSION` and `PROMPTS` in the two files), so that runs of
different models compare.

## Published work this compares with

SARA has 376 cases: 276 entailment cases (176 train, 100 test), which are the ones loaded
here, and 100 numeric cases that ask for a tax owed.

| Work                                                         | Cases                | Setup                                                    | Result                         |
| ------------------------------------------------------------ | -------------------- | -------------------------------------------------------- | ------------------------------ |
| [Holzenberger et al. 2020](https://arxiv.org/abs/2005.05257) | 100 test, entailment | BERT-based reader                                        | 59%                            |
|                                                              |                      | SARA's own Prolog statutes and case facts                | 100%                           |
| [Blair-Stanek et al. 2023](https://arxiv.org/abs/2302.06100) | 100 test, entailment | Majority label                                           | 50%                            |
|                                                              |                      | GPT-3, zero-shot, cited section in the prompt            | 71%                            |
|                                                              |                      | GPT-3, 4-shot, section, "think step by step"             | 60%                            |
| [Blair-Stanek et al. 2023](https://arxiv.org/abs/2309.09992) | all 276, entailment  | GPT-4 with the statute                                   | 67%                            |
| [Jurayj et al. 2025](https://arxiv.org/abs/2508.21051)       | 100 numeric          | GPT-5 answers directly                                   | 76 right, 24 wrong             |
|                                                              |                      | o3 writes statute and case as Prolog                     | 75 right, 15 wrong, 10 abstain |
|                                                              |                      | GPT-4.1 writes the case's facts for gold Prolog statutes | 87 right, 8 wrong, 5 abstain   |
| [Dou et al. 2026](https://arxiv.org/abs/2604.04443)          | 30 hard, entailment  | Claude Sonnet 4.5 directly; as Prolog                    | macro-F1 70.0; 43.9            |
|                                                              |                      | o3 directly; as Prolog                                   | macro-F1 59.5; 32.3            |

How the systems here line up with those:

- `llm-direct` is Blair-Stanek et al.'s best setup, zero-shot with the cited section, and
  the "direct" arm of the two later papers. It is the baseline to beat.
- `llm-factbag` is nearest Jurayj et al.'s gold-statute arm: the statute is formalized by
  hand once, and the model only reads the case. Two things differ. The model does not
  write a program that must then run; it calls a typed tool one fact at a time and is
  told of each mistake it can fix. And the rules are three-valued, so a case can come
  back unknown or conflicted, where a Prolog program either runs or does not.
- Jurayj et al. accept an answer only when two attempts agree, and count the rest as
  abstentions. Nothing here scores two runs that way.
- No system here writes the statute as a program, the arm both later papers find weakest
  on entailment. Their figures stand in for it.

What to keep in mind when reading a number beside these:

- The published entailment figures are on the test split. The rules here were written
  against the train split, so a train score flatters the Factbag systems and only a test
  run of a frozen configuration compares.
- Dou et al.'s 30 cases are the ones frontier models failed, scored by macro-F1 over four
  samples, so their figures are lower than a full-split accuracy would be.
- Jurayj et al.'s cases are the numeric ones, which are not loaded here.

## The Jev Factbag system

One ruleset, written once from the statute text, applied to facts that Jev reads out of
each case. The pipeline for a case is:

1. **Grounding** (`src/jev-factbag/ground.ts`): Jev's classifier, with routing on, fills a fresh
   knowledge base holding the statute's rules. It asserts or denies facts
   over the vocabulary in `src/statute/schema.ts`: marriages, decrees, deaths, births,
   nonresident alien status, family relationships, households, returns, stated amounts,
   employment and payments. Routing keeps the predicates the text may bear on; Clairic
   then reads the passage's values for each of their open fields; routing keeps the
   values the text mentions; and the final classification judges each remaining
   candidate fact. Jev's resolver then settles any fact left with evidence
   of both signs; a case is one passage, so there is seldom one.
2. **Symbols** (`src/jev-factbag/symbols.ts`): `@factbag/symbol-extractor-clairic`, Cloudflare's
   Clairic extraction model on Workers AI, with a `Person` factory. A person's id is
   their name as Clairic reads it. Nothing here decides what is true.
3. **Question reading** (`src/jev-factbag/question.ts`): the citation picks the provision from the
   registry in `src/statute/index.ts`, which fixes the predicate and its roles. Clairic
   reads the question, with the citation taken out, for the people it names, the tax
   year it asks about and any dollar amount; every assignment of them to the
   provision's roles is a reading. With one reading no Jev request is made; otherwise
   Jev picks one in a single choice question.
4. **Query**: the statute decides. A true answer is Entailment, a false one
   Contradiction; anything else is unanswered and scores as wrong.

The statute rules live in `src/statute/`. Each predicate is defined by one `iff`, with
`or` for alternatives, so a false answer is a definite false and sections may negate each
other the way the statute says "unless". Only the text, question and answer of each case
are read; SARA's own Prolog facts and goals are never used.

## Candidates

Every candidate a fact can take comes from Clairic. For each open field of each routed
predicate, it is asked for every value in the passage that could fill that field, with
the predicate's description and the field's parameter description as its instructions,
so the descriptions in `src/statute/schema.ts` steer extraction as well as classification.
People are read as names, amounts and years as numbers, and days as ISO dates. Clairic
does not resolve identity: "her spouse" makes no entity unless Clairic reads a name for
it, and a person the text never names takes no part in the facts.

Under the closed world, a fact predicate the passage offers no candidate for is not
merely unknown but false, so a spouse the text leaves unnamed leaves the taxpayer
unmarried, and a year the text does not name is a year in which nothing happened. A value
Clairic misses is therefore a wrong answer, not an unanswered one.

A question's year is the tax year Clairic reads in it, and must be a plausible tax year
(1900 to 2100). Its people are the names it shares with the case text,
or every name in the text when it names too few. A provision with both a yes-or-no and a
valued form offers both readings, the valued one with each amount Clairic reads other
than the year; Jev then chooses. The question reader takes the year from the question or
reports the question unreadable.

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
both, Jev chooses between the readings, as described under Candidates. The amount sits in the query atom, so
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
