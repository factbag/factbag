---
name: agents-md
description: Create or maintain concise AGENTS.md and CLAUDE.md repository instructions. Use when asked to document agent conventions, set up instruction files, or trim duplicated agent guidance.
license: Apache-2.0
---

# Maintain agent instructions

## Inspect before editing

- Read existing root and relevant nested instruction files, imports, and managed
  block markers before choosing where a rule belongs.
- Check manifests, CI workflows, and nearby code for evidence of commands and
  conventions. Do not turn an inferred preference into repository policy.
- Consult [skill authoring guidance](../README.md) for skill changes and
  [contribution guidance](../../CONTRIBUTING.md) for pull request conventions;
  link to these sources rather than copying their rules.

## Make the smallest useful change

- Keep hand-authored instructions to non-obvious actions, likely pitfalls, and
  precise repository-relative pointers. Omit onboarding prose, generic advice,
  tool-enforced style, and inventories of skills or plugins.
- Put shared rules in root `AGENTS.md`; add nested files only for genuine subtree
  differences. Do not assume every harness loads nested files or gives the closest
  file precedence; verify supported harness behavior before relying on overrides.
- Preserve generated blocks and their markers verbatim, including Turborepo's
  managed guidance. Edit hand-authored sections outside them; do not remove a
  block to meet a line budget or change its generator configuration incidentally.
- Keep `CLAUDE.md` as an `@AGENTS.md` import, not a symlink or a second copy of the
  rules. Preserve any other existing imports and compatible local instructions.
- Link to existing setup, architecture, testing, and release docs where relevant.
  Include a command only when it resolves a non-obvious workflow gap; verify its
  working directory and prefer an available file- or package-scoped check.
- Preserve the repository's lightweight policy: do not add mandatory attribution,
  approval gates, or other process requirements without an explicit request.

## Verify

- Check referenced paths and commands against the checkout, then run the formatter
  on changed Markdown. Review the diff for duplicated rules, conflicting scope,
  changed generated content, and broken imports. Report unverified harness behavior.

## Source

Adapted from [Sentry's agents-md skill](https://github.com/getsentry/skills/blob/d12f250460ffd961f549dbebf7eeb0cf4afd4c2e/skills/agents-md/SKILL.md).
Copyright 2025 Functional Software, Inc. dba Sentry. Licensed under
[Apache-2.0](../../LICENSE). Modified for Factbag's instruction compatibility and
lightweight repository policy; upstream setup and commit-attribution rules omitted.
