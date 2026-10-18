# Releasing Factbag

The four public packages use one fixed version and are published from reviewed tarballs in dependency order. Examples, tooling, and the repository root remain private.

## Release Notes

Add a changeset for every user-visible change:

```sh
pnpm changeset
```

Use an empty changeset when a public-package change intentionally requires no release. Changesets update all four public packages together and leave private workspaces untouched.

## Prereleases

The repository remains in Changesets prerelease mode under the `next` tag until the first external release is approved.

1. Add and review all required changesets.
2. Run `pnpm release:prepare` and review package versions, exact internal dependency versions, and changelogs.
3. Run the complete test and packed-consumer checks.
4. Run `pnpm release:pack` and review `.release/publish-plan.json` and its tarball integrities.
5. Confirm the plan uses the `next` tag and orders Core/Corpus, Guards, then Jev.
6. Publish the reviewed artifacts through the protected release workflow with `pnpm release:publish`.
7. Verify registry metadata, provenance, tags, and external installation before recording the release as complete.

Do not run a direct recursive `pnpm publish`. The Changesets artifact plan fixes the package set, dependency order, dist-tag, and tarball integrity before credentials are available.

## Stable Releases

Promoting the first release requires explicit maintainer sign-off after the external prerelease gate.

1. Run `pnpm release:pre-exit`.
2. Run `pnpm release:prepare` and confirm the generated stable version and changelogs.
3. Repeat all build, test, pack, and external-consumer checks.
4. Confirm `.release/publish-plan.json` uses `latest` only after approval.
5. Publish through the protected release workflow.

## Deprecation

Use `npm deprecate` with a migration message. Do not unpublish a release except for an immediate security or legal emergency and only within npm policy. During `0.x`, deprecation periods are encouraged but not guaranteed.

## Failed Releases

Published versions are immutable and must never be overwritten.

1. Stop publication after any unexpected failure.
2. Compare the registry state with `.release/publish-plan.json`.
3. If the reviewed artifacts are unchanged, rerun the protected publish command; already-published versions are skipped and remaining dependency chunks resume in order.
4. If any artifact must change, add a changeset and prepare a new version instead of reusing the failed version.
5. Do not promote a dist-tag until every package and the external smoke tests pass.
