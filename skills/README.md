# Shared agent skills

Author repository skills here, not in a harness-specific directory. Each skill
has a directory containing `SKILL.md` with matching lowercase kebab-case `name`
and a `description` explaining when to use it. Keep workflows portable: avoid
harness-specific tool names, model settings, and shell interpolation.

Individual relative symlinks expose each skill through `.agents/skills/` (Codex
and OpenCode V2) and `.claude/skills/` (Claude Code). Commit the links with the
skill so fresh clones and worktrees need no setup. Edit the canonical files in
`skills/`, not the harness paths.

After adding, renaming, or removing a skill, run from the repository root:

```sh
node skills/maintain-skills/scripts/sync-links.mjs
node skills/maintain-skills/scripts/sync-links.mjs --check
node --test skills/maintain-skills/scripts/sync-links.test.mjs
```

The updater creates missing links and removes stale links only when their target
matches its managed naming convention. It refuses collisions, incorrect targets,
and symlinked harness parent directories rather than overwriting personal files.
`--check` reports drift without changing files. Unrelated entries are left alone.

Symlink support must be enabled in Git on Windows (`core.symlinks`), and creating
links may require Developer Mode or administrator privileges. A symlink checked
out as a plain text file is not a working skill; the checker reports it as a
collision. Do not replace the links with independently maintained copies.

Discovery paths are harness-specific. When adding another harness, confirm its
documented skill discovery and symlink support before extending the updater.
Verify the maintenance skill can be listed and loaded in each supported harness;
filesystem validation alone does not prove runtime discovery.
