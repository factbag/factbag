# Shared agent skills

Author repository skills here, not in a harness-specific directory. Each skill
has a directory containing `SKILL.md` with matching lowercase kebab-case `name`
and a `description` explaining when to use it. Keep workflows portable: avoid
harness-specific tool names, model settings, and shell interpolation.

Two committed relative directory symlinks expose the same inventory to every
supported harness:

```text
.agents/skills -> ../skills   # Codex and OpenCode V2
.claude/skills -> ../skills   # Claude Code
```

Fresh clones and worktrees need no setup when symlinks are supported. Add,
rename, or remove skills only in `skills/`; the harness paths reflect the change
without regenerating links. These directories share one inventory, so they
cannot contain independent harness-specific additions.

If a link is missing or incorrect, inspect the destination before repairing it.
Do not overwrite an existing directory containing skills or personal files.

Symlink support must be enabled in Git on Windows (`core.symlinks`), and creating
links may require Developer Mode or administrator privileges. A symlink checked
out as a plain text file is not a working skill.
Do not replace the links with independently maintained copies.

Discovery paths are harness-specific. When adding another harness, confirm its
documented skill discovery and directory-symlink support before adding a link.
Verify the maintenance skill can be listed and loaded in each supported harness;
filesystem links alone do not prove runtime discovery.
