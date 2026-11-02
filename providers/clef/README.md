# @factbag/clef

Classification and resolution over Cloudflare's
[Clef](https://developers.cloudflare.com/workers-ai/models/clef-flash/) decision
models on Workers AI. It exports the same names as `@factbag/jev`, from one entry point,
`@factbag/clef`; only the model and how requests reach it differ.

## Install

```sh
npm install factbag@alpha @factbag/clef@alpha
```

`@factbag/clef` is released with `factbag` and needs the same `factbag` version. It
does not need the TypeSafe SDK.

## Inside a Worker

Pass the Workers AI binding. No credentials are read.

```ts
import { classifier } from "@factbag/clef";

const run = classifier({ corpus, input: kb, config: { binding: env.AI } });
for (const job of run) {
  await job.execute();
}
```

## Elsewhere

Without a binding, requests go to Cloudflare's REST API. `accountId` and
`apiToken` default to `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`, which
are read on the first request, not when a run is built:

```ts
import { createConfig } from "@factbag/clef";

const config = createConfig({ model: "clef", minimumProbability: 0.6 });
```

Pass `fetch` to add retries or timeouts. The package adds neither.

## Live check

`pnpm --filter @factbag/clef live [clef | clef-flash]` classifies a short exit
interview through the REST API and checks that one reason is supported, one is
denied, and one is unknown. It reads `CLOUDFLARE_ACCOUNT_ID` and
`CLOUDFLARE_API_TOKEN` from your shell or the repository's `.env`. The token
needs Workers AI read and edit permissions. Tests never call Cloudflare.

## Limits

- `model` is `"clef-flash"` (default) or `"clef"`. Evidence is annotated under `clef`.
- Workers AI accepts at most 64 questions per request. `batchSize` defaults to 64,
  and a larger value throws when the config is created.
- Resolution asks about all of a contradiction's passages in one request. A
  contradiction with more than 64 passages fails when its job runs, before
  anything is sent.
- Clef-flash's context window is 24,576 tokens, shared by the passage and the
  questions. Cloudflare truncates long text state instead of rejecting it.
  Classification chunks passages to about 8,000 characters. The prompts and the
  default batch size were tuned on Jev and have not been evaluated on Clef.
