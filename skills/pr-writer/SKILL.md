---
name: pr-writer
description: Write or refresh concise, reviewer-focused PR titles and descriptions from the full branch diff. Use when preparing changes for review, opening a PR, or updating its title or body.
---

# PR Writer

Write the description as a cover note for reviewers, not a changelog, validation log,
or file-by-file summary.

## Inspect the change

Read applicable repository instructions, including `CONTRIBUTING.md` and PR templates
where available. Inspect the current branch, working tree, existing PR, intended base,
commits, and full branch diff before writing.

For GitHub, authenticated `gh` can provide the PR and repository context:

```bash
git branch --show-current
git status --short
gh pr view --json number,title,body,url,baseRefName,headRefName
gh repo view --json defaultBranchRef
```

If no PR exists, use the user-specified target branch, or the repository default when
none is specified. For an existing PR, use its base unless the user requests another
target. Resolve an up-to-date base ref, then inspect all branch commits and the full
merge-base diff with `git log <base>..HEAD --oneline` and `git diff <base>...HEAD`.
For stacked work, compare against the intended parent branch, not the default branch.

Review the entire diff, including files omitted by truncated output. Do not rely only
on the latest commit, commit messages, a diff summary, or the existing PR description.
Inspect uncommitted changes separately so the description does not claim they are
already included in the PR. If context cannot be retrieved, explain the limitation
rather than inventing it.

## Write the title

Use Factbag's conventional title format:

```text
type(scope): description (TICKET-ID)
type: description (TICKET-ID)
```

Both the scope and ticket suffix are optional. Choose the type and scope that best
describe the dominant full-branch change; consult `CONTRIBUTING.md` for repository
conventions where available. Keep the description specific and concise, without a
trailing period.

Append an associated ticket ID in parentheses when one exists; omit the entire suffix
otherwise. Verify the association from user input, branch or commit context, the PR,
or the tracker. Do not invent an ID or treat the `nt` branch placeholder as a ticket.

For example, without a ticket: `chore(skills): add reviewer-focused PR writing guidance`.
With a verified ticket, append its ID in parentheses to the same title.

## Write the description

- Lead with concrete changed behavior, affected surfaces, and reviewer impact.
- Explain motivation, non-obvious approach, tradeoffs, risks, compatibility, migration,
  or review focus only when they help reviewers understand the change.
- Choose the smallest useful structure. A small change may need only one paragraph;
  use headings or bullets when they improve readability, not as mandatory sections.
- Include meaningful regression coverage or validation only when it informs review;
  do not turn the body into a routine command or CI log.
- Add a compact before/after example, diagram, or visual evidence only when it reduces
  reviewer reconstruction work. Explain what reviewers should notice.
- Replace internal prompt or process terminology with specific resulting behavior.
- When refreshing a PR, describe the current full change rather than narrating the
  sequence of review feedback or revisions. Reassess the title as well as the body.

For example:

```markdown
Shared agent skills now live in one repository directory, exposed to supported
harnesses through relative symlinks. This removes duplicate copies that could drift
between harnesses while keeping fresh clones usable without a generation step.
```

## Present or publish

Return the proposed title and body in chat when asked only to write or suggest them.
Creating or updating a remote PR, pushing commits, and changing draft status require
user authorization; a writing request alone does not authorize those actions. If the
user has already requested publication, proceed within that scope without asking again.
Do not impose draft status.

When authorized, use the repository's available PR tooling to create or update the PR
with the intended base, title, and body. Verify the resulting remote PR and return its
URL. Refresh an existing description when the full diff materially changes what
reviewers need to know.

## Attribution

Adapted and modified for Factbag from
[Sentry's pr-writer skill](https://github.com/getsentry/skills/blob/d12f250460ffd961f549dbebf7eeb0cf4afd4c2e/skills/pr-writer/SKILL.md).
Changes cover Factbag titles, repository context, and authorization before publishing;
upstream draft requirements and unrelated policies are not carried over.

Copyright 2025 Functional Software, Inc. dba Sentry

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License in [LICENSE](../../LICENSE) or at
<https://www.apache.org/licenses/LICENSE-2.0>.
Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
