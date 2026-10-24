---
name: maintain-skills
description: Maintain Factbag's shared skills and harness symlinks. Use when adding, renaming, removing, or editing repository skills, fixing skill discovery, or updating the supported harness locations.
---

# Maintain shared skills

1. Read `skills/README.md` from the repository root. Author skills only under
   top-level `skills/<name>/SKILL.md`. `.agents/skills` and `.claude/skills` both
   link to the entire `skills/` directory; do not create per-skill links or
   harness-specific copies. Create only the skills the user requested.
2. Use standard Agent Skills frontmatter with `name` matching the directory and a
   clear trigger `description`. Keep instructions harness-neutral and reference
   supporting files relative to the skill directory. Do not assume a particular
   tool API, model, or permission setting exists in every harness.
3. After edits, run `node skills/maintain-skills/scripts/check-skills.mjs` from the
   repository root. This read-only checker is bundled at `scripts/check-skills.mjs`
   relative to this skill. Adding, renaming, or removing a skill needs no link
   regeneration. Review frontmatter separately; the checker validates only the
   directory names, regular entry files, and shared directory links.
4. Run `node --test skills/maintain-skills/scripts/check-skills.test.mjs` and check
   formatting with the repository formatter. If a link is broken, inspect its
   destination before repairing it; preserve existing skills and personal files.
   Review `git diff`. Do not commit or push unless requested.
5. If changing harness support, verify its documented discovery paths and symlink
   behavior first, update the script and README together, and confirm discovery
   and loading in that harness. OpenCode V2 already reads `.agents/skills/`;
   it needs no duplicate `.opencode/skills/` links. Report runtime checks that
   could not be performed separately from filesystem checks.
