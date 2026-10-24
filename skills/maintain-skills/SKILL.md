---
name: maintain-skills
description: Maintain Factbag's shared skills and harness symlinks. Use when adding, renaming, removing, or editing repository skills, fixing skill discovery, or updating the supported harness locations.
---

# Maintain shared skills

1. Read `skills/README.md` from the repository root. Author skills only under
   top-level `skills/<name>/SKILL.md`; harness directories contain links, not
   additional copies. Create only the skills the user requested.
2. Use standard Agent Skills frontmatter with `name` matching the directory and a
   clear trigger `description`. Keep instructions harness-neutral and reference
   supporting files relative to the skill directory. Do not assume a particular
   tool API, model, or permission setting exists in every harness.
3. After additions, renames, or removals, run
   `node skills/maintain-skills/scripts/sync-links.mjs` from the repository root.
   This script is bundled at `scripts/sync-links.mjs` relative to this skill.
   Inspect collisions rather than deleting files to make the script pass.
4. Run the updater with `--check`, then run
   `node --test skills/maintain-skills/scripts/sync-links.test.mjs`. Check formatting
   with the repository formatter. Review `git diff` and stage canonical files and
   their changed symlinks together. Do not commit or push unless requested.
5. If changing harness support, verify its documented discovery paths and symlink
   behavior first, update the script and README together, and confirm discovery
   and loading in that harness. OpenCode V2 already reads `.agents/skills/`;
   it needs no duplicate `.opencode/skills/` links. Report runtime checks that
   could not be performed separately from filesystem checks.
