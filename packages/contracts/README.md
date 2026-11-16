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
