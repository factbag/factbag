# ContractNLI eval

Measures Factbag against the Jev baseline in
[Same Scores, Different Decisions](https://arxiv.org/abs/2609.27678) on
[ContractNLI](https://stanfordnlp.github.io/contract-nli/) (CC BY 4.0): 17 fixed
hypotheses per NDA, each labelled entailment, contradiction, or not mentioned.

The dataset is not vendored. Put its `train.json`, `dev.json` and `test.json` in
`$FACTBAG_DATA_DIR/contract-nli`, or pass `--data DIR`.

```sh
pnpm --filter @factbag/contract-nli-eval eval --protocol paper --split dev
pnpm --filter @factbag/contract-nli-eval eval --protocol authored --split test
pnpm --filter @factbag/contract-nli-eval exec tsx src/rescore.ts results/authored/dev.jsonl --split dev
```

## Protocols

- `paper`: the authors' Jev request, reproduced verbatim from their released
  protocol. Whole contract as state, seventeen Choice questions in one request.
- `naive`: Factbag's classifier with one predicate per hypothesis, described by the
  hypothesis text alone. Isolates what chunking, admission and aggregation do before
  any authoring.
- `authored`: the same, with predicate descriptions written once from the train
  split's evidence spans and the dev split's errors. The test split was never read
  during authoring. See `src/protocols/authored.ts`.
- `rules`: `authored` with the three hardest hypotheses decomposed into narrower
  assert-only sub-claims combined by KB rules and a contra atom.
- `paper-authored`, `paper-authored-single`, `batched`: controls outside the
  framework that add the authored guidance to the paper's request, ask one question
  per request, and reproduce the classifier's chunking and admission with all
  questions batched per chunk. See `src/protocols/batched.ts`.

`rescore.ts` re-derives labels from a run's stored probabilities under other
admission policies, so thresholds can be explored without new requests.

## Results on the official test split (123 contracts, 2,091 judgments)

Jev 1.13.0 throughout. Intervals are 95% whole-contract bootstrap percentiles.
Cost is Jev's list price applied to reported input tokens.

| Protocol                  | Accuracy             | Macro-F1 | Recall E / C / N   | USD / contract |
| ------------------------- | -------------------- | -------- | ------------------ | -------------- |
| paper (this reproduction) | 77.52 [76.04, 79.01] | 72.41    | 87.1 / 76.8 / 67.4 | 0.000228       |
| paper (as published)      | 77.38 [75.99, 78.81] | 72.23    | 88.2 / 81.3 / 58.8 | 0.000228       |
| naive                     | 78.57 [77.00, 80.11] | 73.71    | 86.4 / 81.4 / 69.6 | 0.002339       |
| authored                  | 86.75 [85.37, 88.04] | 82.66    | 93.8 / 79.5 / 81.0 | 0.002638       |
| rules                     | 86.85 [85.51, 88.19] | 82.79    | 93.6 / 76.8 / 82.1 | 0.003080       |

For comparison, the paper's best generative configuration, Gemini 3.1 Pro Preview,
scored 83.21 [81.68, 84.79] at USD 0.008474 per contract, and Gemini 3.5 Flash-Lite
82.54 [81.11, 83.98] at USD 0.001353.

The three controls separate the ingredients. The guidance alone, in the paper's
request, is worth about 5.7 points. Asking one question per request adds nothing.
Reading the contract in 8,000-character chunks, admitting only answers above the
classifier's threshold with IRRELEVANT as the default, and aggregating across chunks
adds a further 3.5 points. The `batched` control sends exactly what the classifier
would send if it batched a chunk's predicates into one request: same accuracy as
`authored` at a quarter of the cost, about three times the paper's request.

Caveats: the generative models in the paper received no hypothesis-specific
guidance, so this is a comparison of workflows, not of models. Dev-split numbers
for `authored` and `rules` are optimistic, since dev errors informed the authoring.
ContractNLI's own labels are noisy on several hypotheses.
