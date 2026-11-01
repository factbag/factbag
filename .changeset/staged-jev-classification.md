---
"factbag": minor
---

Reorganize classification and resolution to separate evidence workflows from model requests. The workflows own evidence admission and knowledge-base updates; the Jev implementation owns prompts, encoding, batching, and response validation.

**Breaking changes:** call the classifier with `classifier({ corpus, input, config })`. Classification and resolution jobs now expose only `execute(): Promise<void>`; read the resulting knowledge base from `run.kb`. Job metadata and assessment and resolution reports are removed. Replace `RequestConfig`, `ResolutionConfig`, and nested `AdmissionPolicy` settings with the shared, flat `Config`. Pass an SDK client directly instead of implementing the removed custom client interfaces.

Classification now executes one job per chunk across all permitted predicates. All responses for the chunk must validate before its evidence is written. Failed jobs can be retried without partial evidence, repeating the chunk's requests; successful repeats add fresh evidence.

Expose `createConfig`, `Config`, and shared `DEFAULT_*` constants through `factbag/jev/config`. Normalize settings once and preserve a shared lazy client when a factory-created config is reused across workflows.

Export `fieldEquals` from `factbag/dsl` and use core equality in Jev: entities compare by constructor and ID, dates by instant. Resolution now groups contradictory evidence about separate instances of the same entity.

Encode candidate values when building requests, using the original entities and dates instead of construction-time JSON snapshots. Candidate domains remain fixed at run construction.
