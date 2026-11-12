# @factbag/llm

A guarded knowledge base as a provider-neutral LLM tool. This package
holds everything that does not depend on the model vendor:

- the tool's definition: one tool, `knowledge_base`, whose description lists what it
  acts on: each predicate the guard permits, with the operations it allows of `assert`,
  `deny`, and `query`, and each entity class the options let the model `add`;
- running a call: argument validation, entity lookup, and the evidence
  metadata (`justification`, `source`) stored with each write;
- `CorrectableToolError`, thrown for mistakes the model can fix.

Applications don't import this package. They import a provider package, such as
`@factbag/openai`, which translates the definition into its wire format and
re-exports the toolkit. Calling the model is left to the application.

## Writing a provider

A provider maps `Toolkit.tools()` to its tool format and answers its tool calls with
`Toolkit.call(name, args)`. The call returns the `text` for the model and an
`outcome` for the application, which the provider should pass on. It turns
`CorrectableToolError` into a result the model can read. Other errors should
propagate.
