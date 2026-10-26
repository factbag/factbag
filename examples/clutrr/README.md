# CLUTRR eval

An evaluation of Factbag on CLUTRR, the Compositional Language Understanding and Text-based
Relational Reasoning benchmark (Sinha, Sodhani, Dong, Pineau and Hamilton, EMNLP 2019;
[arXiv 1908.06177](https://arxiv.org/abs/1908.06177)). Each story is a few sentences about
a family, generated from a kinship graph and worded with crowd-sourced templates; the
question asks how one named person is related to another, and the answer is one of 22
gendered labels (son, grandmother, niece, father-in-law and so on). Answering takes a
chain of k stated relationships, the story's clause length; the benchmark trains on short
chains and tests on longer ones, which is the systematic-generalisation question.

The data is CC BY-NC 4.0 and is not vendored. Download the authors' pre-generated archive
(`data_publish.zip`, linked from the authors' repository), extract the configuration
`data_089907f8` from it, and pass its directory with `--data`, or set `FACTBAG_DATA_DIR`
so it is found at `$FACTBAG_DATA_DIR/clutrr/data_089907f8`.

## Protocol

- **Dataset version.** The authors' EMNLP release, `data_emnlp_final/data_089907f8.zip`,
  SHA-256 of the outer archive
  `b4029f68e555ba89dd5836d5f1d9049ca97fc54ed71ed880a5f5351f6c40228e`. This is the
  "Generalization - holdout - clean" configuration: no noise facts, AMT templates
  (`amt_placeholders_clean.json`), one file per split and clause length.
- **Splits.** Train: `1.2,1.3_train.csv`, 10,094 stories of clause length 2 and 3. Test:
  `1.k_test.csv` for k = 2 to 10, 1,146 stories in all (38, 105, 190, 174, 107, 144, 150,
  119 and 119 by length; the generator's configuration asked for 100 per length and the
  release holds these). The HuggingFace mirror `CLUTRR/v1` calls this configuration
  `gen_train23_test2to10`.
- **Labels.** The 22 gendered names of the benchmark's eleven relation keys, from
  `clutrr/store/rules_store.yaml` in the generator: son, daughter, father, mother, husband,
  wife, brother, sister, grandson, granddaughter, grandfather, grandmother, son-in-law,
  daughter-in-law, father-in-law, mother-in-law, brother-in-law, sister-in-law, nephew,
  niece, uncle, aunt. Both systems choose among exactly these.
- **The question.** A row's `query` is a pair (first, second) and its `target` the label
  that completes "second is first's ___". Checked against the generator's own proofs on
  every training story (`src/kinship.test.ts`).
- **What each system sees.** The story text with the generator's name brackets removed,
  the two names, and the label set. Nothing else from the CSV reaches either system. The
  generator's proof and genders are read after prediction, to attribute failures.
- **Scoring.** Exact match on the label. A story without a prediction scores wrong and is
  counted in the denominator, with its reason. Accuracy is reported overall and by clause
  length with a 95% bootstrap interval, alongside requests, input tokens, cost at Jev's
  list price and latency.
- **Freeze.** Predicate wording, rules, routing thresholds, admission policy, the answer
  rule and the baseline prompt were fixed on training samples (below), then the test split
  was run once for each system.

Comparable published numbers: the paper's Figure 5 reports supervised models trained on
k = 2, 3 falling from near-perfect at k = 2, 3 to roughly 0.15 to 0.3 at k = 10. Yang,
Ishay and Lee (ACL Findings 2023, [arXiv 2307.07696](https://arxiv.org/abs/2307.07696))
pair GPT-3 with answer-set programming, on the robustness configurations rather than this
one, and note that a tenth or so of CLUTRR 1.0 stories do not state what their gold proof
needs; the same holds here (see Failures).

## What is being tested

One ruleset, the benchmark's own kinship rules transcribed once from its rules file,
applied to the relationships Jev reads out of each story. The pipeline for a story:

1. **People** (`@factbag/eval-shared/names`): the shared name scanner lists the capitalised
   names in the text. These are the entities; nothing here decides what is true.
2. **Grounding** (`src/ground.ts`): a knowledge base holding the kinship rules, the people,
   and whatever the shared staged Jev classifier asserts or denies over the eight closed
   fact predicates in `src/schema.ts`: parent, spouse, sibling, grandparent, parent-in-law,
   sibling-in-law, uncle-or-aunt, and each person's gender as the story's words give it.
   Each inverse pair of the benchmark's keys is one ordered predicate; the symmetric ones
   take either order.
3. **Rules** (`src/kinship.ts`): one derived predicate per relation key, defined
   recursively by what the story states, by its counterpart read the other way round, and
   by the sixteen compositions of the rules file. The eleven predicates form one recursive
   component; being closed-world and never asserted, the solver tables it and judges its
   atoms as a least fixed point. One query per story reads every key that holds from the
   first person to the second.
4. **Answer** (`src/answer.ts`): the one derived key, with the second person's extracted
   gender, gives the label. Several derived keys, none, or an unsettled gender leave the
   story unanswered, with the reason recorded.

The derived predicates are never asserted, so a judgment's explanation separates what was
read from what was reasoned: its evidence leaves are the stated facts the answer rests on,
and each record lists them per derived key (`supporting`) and whether the answer needed a
composition (`derived`).

The rules use `if`, not `iff`: a relation the rules derive is true, one they do not is
unknown rather than denied, which is all the question asks. An `iff` definition of a
recursive predicate cannot be queried with a free key variable, because the solver's query
validation wants a base rule whose body stays out of the component; and eleven ground
`iff` queries cost about eight times one query in this form.

**Direct baseline** (`src/baseline.ts`): one System One request per story carrying the
story and a choice question over the 22 labels, "second is first's ___", with the kinship
compositions sketched in the task text. No knowledge base, rules or query. Prompt frozen
as `direct-1`.

## Resolving conflicting extractions

The held-out failures are dominated by facts Jev admits that the story does not state,
which join the queried pair by a second path and leave two derivations. The prototype in
`@factbag/jev/recheck` addresses the part of that which the benchmark's own semantics can
expose. CLUTRR's generator draws a family graph in which two people stand in one relation
and labels a query with that one relation, so two people are related in at most one way.
`src/violations.ts` derives two violations from that and nothing else. `stated_twice(a, b)`
holds when the story states two different relations between the same two people, in
whatever direction, over the eight fact predicates. `conflicting_relations(a, b)` holds when
the rules derive two different relations from a to b, by whatever paths, which catches a
spurious fact anywhere along a chain and subsumes the first. (Both are a property of the
benchmark's data, not of families; they live in the example for that reason.)

The derived violation is asked for the queried pair only, not for every pair in the story.
The benchmark's rules are not sound enough to serve as a constraint on their own: they
compose "my child's grandparent" to "my parent", who may equally be my parent-in-law, so a
consistent family with a spouse, a child and a grandparent derives two relations for some
pair from true facts alone. Measured on the saved facts of the two development samples
(kin-4), the constraint over every pair fired in 8 and 13 stories, 6 and 7 of them already
answered correctly, and 70 of the 89 facts it would have reread were gold; asked for the
queried pair it fired in 2 and 5 stories, none of them correct, and would have reread 28
gold facts beside 9 spurious ones. So the question decides where to look again: when it has
two answers, the facts behind both are reread, and a question with one answer disturbs
nothing. This is the general shape of the mechanism, a constraint on conclusions directing
a second reading of exactly the stated facts the conclusions rest on, with the constraint's
reach set by how far the rules can be trusted.

With `--resolve`, `eval` and `replay` derive the violations after grounding, follow each
proof to the extracted facts it rests on, and have Jev reread those facts, one by one,
against the story: the classifier's three-way question again, told that the facts cannot
all hold and asked to judge only what the text states in words. A fact the rereading no
longer admits is retracted; the rest of the story's facts are untouched. The rules then run
again, for at most two rounds. A violation whose facts the rereading all confirms stays,
and the story stays unanswered: the resolver never picks a winner and never sees a gold
answer. Each record carries the facts reread with the classifier's original probability and
the rereading's full distribution, the facts retracted and kept, the pairs left unresolved,
and the requests and latency the rereading cost.

`replay --resolve` applies this to a saved run's facts, so the comparison is paired: the
same extraction with and without resolution. On the two development samples, kin-4's saved
facts, first with `stated_twice` alone and then with both violations:

| sample, violations    | stories with a violation | facts reread | retracted | answers before | answers after | rereading requests |
| --------------------- | ------------------------ | ------------ | --------- | -------------- | ------------- | ------------------ |
| A, stated twice       | 2                        | 4            | 2         | 84             | 84            | 4                  |
| B, stated twice       | 4                        | 9            | 4         | 76             | 77            | 7                  |
| A, both, queried pair | 4                        | 15           | 4         | 84             | 85            | 9                  |
| B, both, queried pair | 7                        | 30           | 8         | 76             | 79            | 14                 |

Checked afterwards against the generator's proofs, every retracted fact in all four runs
was spurious, and of the 32 facts kept under both violations 31 were gold. The one spurious
fact kept, a sibling fact the rereading confirmed at 0.52 that the story does not state
("Michelle had dinner with her sister" names no sister), moved a story from declined to
wrong: with the two spurious parent facts beside it retracted, the rules derived one answer,
daughter, where the gold is sister. The four answers gained were stories whose wrong facts
were all behind the queried pair's conflict. Rereading cost 0.00001 USD per story over the
sample and about 1.3 to 1.9 s per affected story; the violation queries took the solver
under 30 ms per story. The earlier kin-3 development measurement, `stated_twice` alone, is
in `results/replay-resolved-2026-10-25T01-20-*`: 82 -> 82 and 77 -> 79.

The limit is now in what the question depends on. A spurious fact outside the queried
pair's derivations raises nothing, which is right; a gold fact that was never read gives
the pair no derivation at all, so there is no conflict and nothing to reread. The held-out
"no relation derived" failures, the largest group, are of that kind.

**Post-hoc, not held-out evidence.** The same paired replay was run over the saved facts
of the first held-out run, twice: with `stated_twice` alone
(`results/replay-resolved-2026-10-25T01-28-11-899Z`) and with both violations
(`results/replay-resolved-2026-10-25T02-45-09-288Z`). These are labelled debugging
measurements on known held-out failures, made after that run and after the resolver was
built; they are not held-out results. The second held-out run below is. With `stated_twice`
alone, 277 stories had a violation; 1,019 facts were reread in 610 requests, 576 retracted
(549 spurious, 27 gold) and 443 kept (322 gold, 121 spurious); 49 answers changed, 36
gained, 1 lost, 12 between two wrong states; 414 -> 449 (39.2%), 46 stories unresolved. With
both violations, 378 stories had one; 4,387 facts were reread in 1,138 requests (2.7 M input
tokens, a median of 5.4 s per affected story), 1,651 retracted (1,513 spurious, 138 gold)
and 2,736 kept (2,333 gold, 403 spurious); 98 answers changed, 78 gained, 1 lost, 19 between
two wrong states; 414 -> 491 (42.8%), with gains at every length from 3 to 10 and 80 stories
unresolved.

## Running

```sh
pnpm --filter @factbag/clutrr-eval test
pnpm --filter @factbag/clutrr-eval eval --split train --per-length 50 --data /path/to/data_089907f8
pnpm --filter @factbag/clutrr-eval eval --split train --per-length 50 --offset 50
pnpm --filter @factbag/clutrr-eval eval --split test
pnpm --filter @factbag/clutrr-eval baseline --split test
pnpm --filter @factbag/clutrr-eval compare --factbag results/test-staged-<stamp>.jsonl --direct results/baseline-test-<stamp>.jsonl
pnpm --filter @factbag/clutrr-eval replay --facts results/test-staged-<stamp>.jsonl
pnpm --filter @factbag/clutrr-eval eval --split train --per-length 50 --resolve
pnpm --filter @factbag/clutrr-eval replay --resolve --facts results/train-staged-<stamp>.jsonl --data /path/to/data_089907f8
```

`--per-length N` takes the first N stories of each clause length in file order, after
`--offset`, so a development sample is reproducible; `--lengths 2,3` and `--ids` narrow the
selection. Per-story records, with every admitted fact, the derived keys and their
supporting facts, the routing audit and the failure attribution, go to a JSONL file under
`results/` beside a summary. `replay` re-solves a saved run's facts under the current rules
without requests; `compare` sets an `eval` run and a `baseline` run side by side. With the
data present, `test` also checks the rules against the generator's proofs of every training
story. The tests, the kinship rules and the pipeline need the built `@factbag/core`
(`pnpm --filter @factbag/core build`).

## Development

Two disjoint samples of the training split, the first 50 and the next 50 stories of each
clause length (100 stories each), chose among three wordings of the fact predicates. The
rules, routing and admission were the shared defaults throughout and were not tuned.

| wording                                                                                                 | sample A | sample B | spurious facts (A + B) |
| ------------------------------------------------------------------------------------------------------- | -------- | -------- | ---------------------- |
| kin-1: the SARA-style statement rule                                                                    | 81       | 76       | 11                     |
| kin-2: kin-1 plus the three shapes a statement takes, "however briefly"                                 | 82       | 75       | 24                     |
| kin-3: kin-1 plus "a grandparent is not a parent" and the like, and "says nothing about a third person" | 82       | 77       | 15                     |
| direct baseline (`direct-1`)                                                                            | 77       | 81       |                        |
| kin-4, after the held-out run: kin-3 with adoption counted as parenthood                                | 84       | 76       | 7                      |

kin-3 was frozen (`EXTRACTION_VERSION` `kin-3-2026-10-24`) and is the wording of the
held-out run below. kin-4, the current wording, was written afterwards on request and has
been run on the development samples only: it reads an adoptive mother or father as a parent
and an adopted son or daughter as a child, and a stepparent as not a parent. Adoption is
rare in this data (67 of 10,094 training rows mention it anywhere, mostly outside the
story), and no story in either sample does, so its difference from kin-3 is run-to-run
noise; with resolution on kin-4's saved facts, 84 -> 85 and 76 -> 79. Among the first three
wordings the differences are within the samples' noise; kin-2 bought recall with precision, which the rules then turn into
ambiguity. Every development failure was on the extraction side: of the 19 failures of
kin-1 on sample A, six were stories whose text does not state the gold proof (the
generator's template put the names in the wrong slots), eight were stated relationships
Jev judged at probabilities around the admission threshold, four were facts Jev added that
the story does not state, and one was a person the story gives no gendered word for. The
solver was never the cause, and never took more than a second per story.

The benchmark's rules are themselves ambiguous for some stories: a spouse's child's
grandparent is both a parent by (child, inv-grand) and a parent-in-law by (SO, inv-child),
and the gold label follows the path the generator happened to take. In the training split
106 of 10,094 stories (1.0%) are such; they are answered by neither key and are reported
as "ambiguous under the benchmark's rules".

## Held-out results

Two runs of the pipeline and one of the direct baseline over the whole test split, 1,146
stories, with `jev-1.13.0`. The first pipeline run, on 2026-10-25 under kin-3 without
resolution (`results/test-staged-2026-10-25T00-38-11-097Z`), was frozen as the result of the
extraction work; the direct baseline (`results/baseline-test-2026-10-25T00-29-16-717Z`) ran
the same day, and its prompt has not changed since. The second pipeline run, on 2026-10-25
under kin-4 with `--resolve` (`results/test-staged-resolved-2026-10-25T03-07-12-628Z`,
compared in `results/compare-2026-10-25T03-07-51-456Z`), was made once, after the resolver
was built and measured on the development samples and in the post-hoc replays above, and is
the result of the resolution work. Neither has been rerun.

| k   | stories | Factbag, kin-3           | Factbag, kin-4 + resolution | direct Jev               |
| --- | ------- | ------------------------ | --------------------------- | ------------------------ |
| 2   | 38      | 31 (81.6%)               | 31 (81.6%)                  | 35 (92.1%)               |
| 3   | 105     | 55 (52.4%)               | 56 (53.3%)                  | 42 (40.0%)               |
| 4   | 190     | 72 (37.9%)               | 76 (40.0%)                  | 107 (56.3%)              |
| 5   | 174     | 77 (44.3%)               | 91 (52.3%)                  | 76 (43.7%)               |
| 6   | 107     | 51 (47.7%)               | 58 (54.2%)                  | 51 (47.7%)               |
| 7   | 144     | 55 (38.2%)               | 67 (46.5%)                  | 56 (38.9%)               |
| 8   | 150     | 40 (26.7%)               | 53 (35.3%)                  | 40 (26.7%)               |
| 9   | 119     | 21 (17.6%)               | 35 (29.4%)                  | 37 (31.1%)               |
| 10  | 119     | 12 (10.1%)               | 23 (19.3%)                  | 37 (31.1%)               |
| all | 1,146   | 414 (36.1% [33.4, 38.9]) | 490 (42.8% [39.9, 45.6])    | 481 (42.0% [39.2, 44.9]) |

Against the direct baseline, the first run was right alone on 178 stories and the baseline
alone on 245, with 236 both and 487 neither; the second run was right alone on 232 and the
baseline alone on 223, with 258 both and 433 neither. The two pipeline runs differ in the
wording (kin-3 to kin-4, which the development samples put within run-to-run noise) and in
resolution, and the second run's by-length pattern follows the post-hoc replay's closely
(491 there, on the first run's facts), so the gain is the resolver's.

Precision, answers right among answers given: the first run answered 456 stories and was
right on 414 (90.8%); the second answered 552 and was right on 490 (88.8%); the baseline
answers every story and is right on 42.0%. Resolution moved 96 stories from declined to
answered and 20 of them to a wrong answer.

The direct baseline cost one request and 922 input tokens per story (USD 0.00004) at a
median of 65 ms. The first pipeline run cost 10.0 requests and 118,792 input tokens per
story (USD 0.005) at a median of 991 ms, of which the solver took a median of 153 ms (17 ms
at k = 2, 941 ms at k = 10, at most 3.0 s). The second cost 10.9 requests and 123,215 input
tokens per story (USD 0.0052) at a median of 1,342 ms, the solver a median of 140 ms and at
most 2.5 s; 1,115 of its requests were rereads. Resolution fired in 366 stories, retracted
1,607 facts (1,488 spurious, 119 gold against the generator's proofs) and kept 2,655 (2,239
gold, 416 spurious), and left 82 stories with an unresolved conflict. The run took 21
minutes at two stories at a time, against 9.4 for the first; the rereads run one request at
a time within a story.

Both systems fall with clause length, as the paper's supervised models do; both stay above
the paper's models at k = 9 and 10 (0.15 to 0.3) without training. With resolution the
pipeline is ahead of direct Jev from k = 5 to 8 and at k = 3, level at k = 9, and behind at
k = 2, 4 and 10.

### Failures

Every pipeline failure is attributed, by comparing the extracted facts with the
generator's proof after the fact; the first run's 732 and the second run's 656:

| category                                       | kin-3 | kin-4 + resolution |
| ---------------------------------------------- | ----- | ------------------ |
| extraction: gold facts missed and others added | 365   | 338                |
| scanner: a named person not found              | 156   | 153                |
| extraction: facts added                        | 117   | 27                 |
| extraction: gold facts missed                  | 72    | 109                |
| ambiguous under the benchmark's rules          | 13    | 16                 |
| extraction: gender                             | 9     | 13                 |
| rules                                          | 0     | 0                  |

By reason for having no answer, first run then second: 325 then 424 stories derived no
relation between the queried pair, 258 then 53 derived several, 85 then 85 lacked one of the
queried people, 22 then 32 lacked or had two genders for the second person; 42 then 62
answered wrongly. Resolution took "several relations" down by four fifths; what it could not
reach shows up as "no relation derived", stories whose gold facts were never read, and in
the 119 gold facts the rereading retracted. The failure analysis below is the first run's;
its categories hold for the second.

- **Precision falls with the number of people.** The staged classifier admitted at least
  one relationship the story does not state in 584 of the 732 failed stories; with eleven people
  and 110 ordered pairs per predicate, a few false positives are enough to join the queried
  pair by a second path, and the rules then derive two keys (245 of the 258 "several
  relations" stories carry a spurious fact). This is the dominant failure from k = 7 up
  and the reason the pipeline loses to the direct baseline at k = 9 and 10: the baseline
  guesses one label and is right a third of the time, while the pipeline refuses to pick
  between two derivations.
- **The scanner merges names the generator ran together.** The release's longer stories
  often join two template sentences without punctuation ("his wife [Vanessa] [Alma] and her
  son"), so two adjacent names read as one ("Vanessa Alma"); 242 stories have such a merged
  name, and 66 of the 85 "person not found" stories do. The multi-word rule is the shared
  scanner's, kept for SARA's "Walter Brown Family Trust II"; no CLUTRR-specific rule was
  added.
- **Recall at the admission threshold.** Stated relationships in subordinate phrases ("his
  mother Dorothy") sit near Jev's 0.4 admission probability and are missed in some runs
  and admitted in others; development runs of the same 100 stories differed by one to
  three answers for this reason alone.
- **Data.** About a tenth of stories do not state what their proof needs, the known
  template-slot errors of CLUTRR 1.0; these count against both systems. Thirteen stories
  have two answers under the benchmark's own rules.
- **Rules and solver.** No failure was attributed to the rules: whenever the extracted
  facts were exactly the gold facts, the derived key was the gold key. The tabled
  recursive component stayed under a second per story at the median for the longest
  clauses.

### Reading

Factbag's contribution is exactly where the story's facts are read right: at k = 3 the
rules compose what Jev extracted and beat the direct guess by twelve points, and on the
236 stories both systems answer, the pipeline's answer comes with the stated facts it
rests on. The pipeline's weakness is upstream of the rules, in extraction precision over
many candidate pairs, and it is honest about it: it declines rather than guesses. A fairer
reading of the two systems than the overall accuracy is the "neither" column, 487 stories
neither gets, most of them stories where the text itself does not carry the proof.
