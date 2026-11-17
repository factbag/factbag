# Contracts

`spec/main.tsp` defines the JSON representation for knowledge-base data and solver
results. TypeSpec emits `schema/factbag-contracts.json`; edit the definitions, then
run `pnpm --filter @factbag/contracts generate` to update the schema.

The package is private and has no runtime entrypoint. The current DSL and solver
have not adopted this representation. Runtime conversion, HTTP endpoints, and MCP
tools are separate work.

The schema validates document structure. It does not resolve predicate or entity
names, check rule safety, or validate calendar dates beyond their string format.

The TypeSpec JSON Schema emitter is listed explicitly in Knip because it is loaded
through TypeSpec imports and configuration. The workspace pins the compiler's
prompt dependencies to versions compatible with the repository's minimum Node version.

Generation also emits TypeScript types and dependency-free validators in
`src/generated/`, plus a JSON Schema bundle with local references for other language
generators. These are generated outputs, not independently maintained definitions.
The generated files are Knip entrypoints so their full schema surface can exist
before runtime integration without being treated as unused handwritten code.

Run `pnpm --filter @factbag/contracts test` to exercise generated validation of
nested rules, evidence, documents, and solver results. Validators report JSON
Pointer locations for invalid input; they do not throw or resolve names.
