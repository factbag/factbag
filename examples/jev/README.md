# Jev examples

`src/j1.test.ts` runs all five J-1 cases from `@factbag/scenarios/j1` using standard
Vitest hooks, `vi.stubEnv`, and MSW HTTP handlers. Each test follows Arrange / Act /
Assert and calls `classifier(corpus, guard(kb).permit("*", predicates.tenureTrack))`
without injecting a client.

Scripted model responses live here, independently of the document annotations.
The test checks the exact request state to ensure ground-truth metadata is not
sent to the model, then checks extraction, provenance, query outcomes, and the
unchanged input KB.

Both cross-document and single-document contradictions are covered. For the latter,
the scripted response uses a 0.5 ASSERT / 0.5 DENY tie, which the existing default
admission policy admits on both sides. This exercises the current client contract;
the three-way model question and admission policy are unchanged.

`src/demo.tsx` is an end-to-end walkthrough of the J-1, OFAC or haystack scenario against the live Jev API, rendered with Ink. It shows the
question, the full knowledge base before reading, each document's result as it arrives,
the proof tree behind the answer with every leaf pointing at its source, then how each
contradiction was resolved and the answer that follows from the surviving evidence. It reads `TYPESAFE_API_KEY` from the shell or the repo's `.env`. Run it with no
arguments in a terminal to pick a scenario from a menu, or name one: `ofac`, `haystack`, or `j1`
with a case (default `contradictory`). Without a terminal it runs the J-1 contradictory case. The closing answer-key check is
temporary; it moves to the eval once that exists.

```sh
pnpm --filter @factbag/jev-examples test
pnpm --filter @factbag/jev-examples demo [j1 [case] | ofac]
pnpm --filter @factbag/jev-examples typecheck
```

An eval can consume the same factories with a live client and its own scoring.
Document annotations cover the factory's explicit targets; a wider predicate
candidate domain requires additional labels or separately scoped scoring.
