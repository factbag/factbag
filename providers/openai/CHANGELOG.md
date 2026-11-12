# @factbag/openai

## 0.1.0-alpha.7

### Minor Changes

- 1eca9be: Add `@factbag/openai`: a guarded knowledge base as a tool for OpenAI and OpenAI-compatible Chat Completions APIs. `toolkit(guard(kb).permit(...))` offers the model one strict function tool, `knowledge_base`, which runs one operation per call: `assert`, `deny`, or `query` on a permitted predicate, and with the `entities` option `add` to register an entity of a class. A call gives the `operation`, the `name` it acts on, and the `arguments`. The tool's description lists each predicate once, with the operations it allows, and states each argument's note once. `kit.tools()` returns the tool for the request, and `kit.answer(call)` runs one call and returns its tool `message` with an `outcome` that tells your code what the call did. A query tells the model the value alone, or with the `explain` option an explanation of it, cut to a budget of claims. Mistakes the model can fix, such as malformed JSON, an unknown operation, and invalid arguments, are returned in the message so the model can retry. Your code calls the model; the package needs no OpenAI SDK.

### Patch Changes

- factbag@0.1.0-alpha.7
