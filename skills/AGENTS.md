# Authoring repository skills

Create only skills requested by the user. Keep skills specific to useful Factbag
workflows and portable across supported harnesses. Avoid harness-specific tool
names, model settings, discovery paths, and shell interpolation in instructions.
Use the [Agent Skills format](https://agentskills.io/specification).

## Directory structure and naming

Give each skill a lowercase kebab-case directory under `skills/`, such as
`check-api-compatibility`. Use the exact filename `SKILL.md` as its entry point.
Add supporting directories only when needed:

```text
skills/
└── check-api-compatibility/
    ├── SKILL.md
    ├── references/   # Optional documentation loaded on demand
    └── scripts/      # Optional helpers for repeatable operations
```

This is an illustrative layout, not a request to create the example skill.
Reference supporting resources with paths relative to the skill directory, such
as `references/compatibility.md` or `scripts/check.mjs`, rather than absolute
machine-specific paths.

## Minimal frontmatter

Start `SKILL.md` with YAML frontmatter containing `name` and `description`:

```yaml
---
name: check-api-compatibility
description: Check Factbag public API compatibility. Use when reviewing exported API changes or preparing a release with API changes.
---
```

Match `name` to the directory name. Make `description` explain both the skill's
purpose and the situations that should trigger it. Add other supported metadata
only when the workflow needs it.

## Concise instructions and on-demand references

Keep `SKILL.md` under 500 lines and focused on the workflow, decisions, and
constraints the agent needs when the skill is loaded. Do not repeat general
knowledge or repository documentation that can be linked instead. Choose sections
that help the task; no fixed set of template sections is required.

Move detailed examples, domain-specific guidance, and lengthy reference material
into `references/` as needed. Link each resource from `SKILL.md` and explain when
to read it, so the agent loads only what the current task requires. Keep reference
files focused and avoid chains of references that obscure essential instructions.

## Optional scripts

Add a script only when it makes a repeatable operation more reliable than written
instructions. Do not add scripts or dependencies just to fill out the layout.

- Use portable Bash or Node.js conventions and document runtime requirements.
  For Bash, use `#!/usr/bin/env bash` and avoid platform-specific utilities where
  practical. For Node.js, use the repository's supported Node versions and an
  explicit module format, such as `.mjs` for ES modules.
- Document how to invoke each script, its inputs, and its output in `SKILL.md`.
  Resolve bundled resources relative to the script's location, and state any
  required working directory for repository operations.
- Quote shell paths and arguments, validate inputs, and return a nonzero exit code
  on failure.
- Send status messages and diagnostics to stderr. When callers consume structured
  results, keep stdout machine-readable, such as JSON, without progress messages.
- Create temporary files safely and clean them up on success and failure, using
  a Bash `trap` or a Node.js `finally` block as appropriate.
