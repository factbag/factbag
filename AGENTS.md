<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->

## Repository Overview

Factbag is a TypeScript library that turns documents into evidence and conclusions
using TypeSafe AI’s Jev model. It combines source-linked evidence with application
facts and rules in a queryable knowledge base, supporting true, false, conflicted,
and unknown conclusions.

## Keep interfaces narrow

Keep symbols at the narrowest practical scope. Export or re-export only for a
concrete consumer across that boundary, not speculative reuse or testing
convenience. Internal module exports are not package entrypoints; public exports,
including exposed types, are compatibility commitments. Do not create oversized
files or awkward abstractions merely to avoid internal exports.

## Agent skills

When adding or changing agent skills, follow [skills/README.md](skills/README.md).

## Pull requests

Follow the [pull request title convention](CONTRIBUTING.md#pull-request-titles)
when opening a pull request.
