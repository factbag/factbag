# @factbag/openai

A guarded knowledge base as a tool for OpenAI and any OpenAI-compatible
Chat Completions API, such as vLLM, Ollama, or OpenRouter. The package describes
the tool and runs its calls. Your code calls the model, with whichever client,
retries, and loop it prefers.

## Install

```sh
npm install factbag@alpha @factbag/openai@alpha
```

`@factbag/openai` is released with `factbag` and needs the same `factbag` version.
It does not depend on the `openai` SDK.

## Usage

The model is offered one tool, `knowledge_base`, which runs one operation per call. The
guard decides which operations exist: `assert`, `deny`, or `query` on each permitted
predicate. The tool's description lists the predicates, one per line with the operations
each allows, and states each argument's note once. A call gives the `operation`, the
`name` of the predicate, and the `arguments` as a JSON object in a string.

One tool rather than one per operation keeps the request small. A definition per
operation repeats itself, and for a vocabulary of about a hundred predicates the
definitions were roughly twice the size of the one tool's description.

```ts
import { guard } from "factbag/kb";
import { toolkit } from "@factbag/openai";
import OpenAI from "openai";

const kit = toolkit(guard(kb).permit("assert", employed).permit("query", eligible), {
  source: "intake-chat",
});
const client = new OpenAI();

const response = await client.chat.completions.create({
  model: "gpt-5",
  messages,
  tools: kit.tools(),
});
const message = response.choices[0].message;
messages.push(message);
for (const call of message.tool_calls ?? []) {
  if (call.type === "function") {
    messages.push(kit.answer(call).message);
  }
}
```

Call `kit.tools()` before each request. Entity IDs are listed in the tool's description,
and wildcard grants are resolved against the knowledge base, so it changes as the
knowledge base does.

## Tool calls

`kit.answer(call)` runs one call and returns `{ message, outcome }`. `message` is the
`role: "tool"` message to send back. `outcome` tells your code what the call did,
so that you don't parse the message: the `atom` an assert or deny wrote, the `atom`
and `judgment` of a query, or the `entity` an add registered.

```ts
const { message, outcome } = kit.answer(call);
messages.push(message);
if (outcome?.operation === "query") {
  console.log(outcome.judgment.value);
}
```

A query's message tells the model the value alone, such as `{"value":"true"}`:
`true`, `false`, `unknown` or `conflicted`. The full judgment, with the proof behind
it, is in the outcome. With the `explain` option, the message also carries an
`explanation` of the value.

A mistake the model can fix becomes `Error: …` in the message's content, so the
model can retry on its next turn, and has no outcome. Examples include malformed
JSON, an unknown tool, a missing or extra argument, or an unknown entity ID. Any
other error is thrown.

## Entities

An argument can only name an entity that the knowledge base already holds. To
let the model register the entities it finds, such as the people a document names,
pass a factory for each entity class. Each lets the model run `add` on the class,
named in snake case, with an `id`:

```ts
const kit = toolkit(guard(kb).permit("assert", employed), {
  entities: [[Person, (id) => new Person(id)]],
});
// The model can now add a person, then assert employed with that id.
```

Registering an ID that the knowledge base already holds keeps the existing entity.

## Options

- `requireJustification` (default `true`) adds a required `justification`
  argument to assert and deny operations and stores it with the evidence.
- `source` is stored as the `source` of all evidence the tool writes.
- `explain` (default `false`) adds an explanation to what a query tells the model:
  the claim, the rule or evidence behind it, and the claims it rests on, nested. A
  whole proof can be megabytes, so the explanation is cut to a budget of claims,
  20 for `true` or the number you pass as `{ budget: 40 }`. What decided the value
  is explained first, and a claim names the claims left unexplained under
  `notShown`.
- `entities` lets the model register entities. See [Entities](#entities).

## Arguments

Every argument is a JSON primitive. Entities are their IDs, and dates are ISO
8601 strings. Enumerations are listed in the schema, with date members as ISO
strings. Schemas are strict: every property is required and no others are
allowed.
