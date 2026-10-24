# Releasing Factbag

Only the `factbag` package is published. The component packages (`@factbag/core`, `@factbag/corpus`, `@factbag/guards`, `@factbag/jev`), widgets, examples, tooling, and the repository root are private workspaces and are never published.

Releases are published from reviewed tarballs to the `latest` dist-tag. The current line is `0.0.0-alpha.N`: every version is a prerelease and APIs may change between any two releases.

## Publishing workflow

The **Publish** workflow builds and tests the package, then waits for approval through the `npm` environment. Approval publishes the tested tarball using OpenID Connect (OIDC) and creates its Git tag.

Dry runs exercise the same artifact handoff and verification as live releases, without publishing permissions or environment approval. They do not test npm authentication.

The publish job verifies artifact integrity, installs no project dependencies, and disables package scripts. It runs `npm publish` once; errors fail the job.

## Artifact verification

Run `pnpm build && pnpm build:verify` to test the current checkout. This packs
`factbag` with pnpm into a temporary directory and checks the tarball and isolated
consumers, regardless of whether its version is already published. CI uses this
path. It does not create or modify the release publish plan.

`pnpm release:verify` instead checks the Changesets publish plan and its exact
tarballs in `.release/`, using the same artifact and consumer checks. An empty
publish plan is an error in this release-only workflow.

## Release notes

Add a changeset for every user-visible change:

```sh
pnpm changeset
```

Use an empty changeset when a change intentionally requires no release. Changesets only version `factbag`; private workspaces are left untouched.

## Alpha releases

1. Prepare a version bump in `packages/factbag/package.json` and move the changeset notes into `packages/factbag/CHANGELOG.md`. The `0.0.0-alpha.N` line uses manual versioning because Changesets cannot compute these versions outside prerelease mode.
2. Merge the version and changelog pull request after review and CI pass.
3. In GitHub Actions, run **Publish** on `main` with the committed version. Disable **Build and verify without publishing** for a live release. Leave it enabled if you only want to test the release workflow.
4. When the workflow requests approval, confirm the version, source commit, and successful checks, then approve the `npm` environment deployment.
5. Check that the workflow succeeded. The package is published under `latest`, with a `factbag@<version>` Git tag.

The workflow uses the commit selected when you start the run and serializes releases. Release artifacts are retained for 14 days for investigation or recovery. A dry run requires an unpublished version; use `pnpm build:verify` to check an already-published version.

## Leaving the alpha line

When the API is ready for ordinary semver, run `pnpm release:prepare` with a changeset to produce the first non-prerelease version (for example `0.1.0`), then follow the alpha release procedure from step 2. From that point Changesets computes versions and changelogs automatically.

## Deprecation

Use `npm deprecate` with a migration message. Do not unpublish a release except for an immediate security or legal emergency and only within npm policy. During `0.x`, deprecation periods are encouraged but not guaranteed.

## Failed releases

Inspect the failed job before retrying. Published versions are immutable.

- **Version absent from npm:** fix the cause and select **Re-run failed jobs** to reuse the original artifact.
- **Version already published:** do not rerun publication. Compare npm's `dist.integrity` with the retained `release.json` and check `latest`. If only tagging failed and the tag is absent, rerun the tag job. If npm accepted the release but reported an error, verify the registry result and create the missing tag at the commit recorded in `release.json`.
- **Artifact changed or expired:** prepare a new version. Investigate unexpected integrity, dist-tag, or Git tag values; do not overwrite an existing release tag.

Avoid **Re-run all jobs** after publication: Changesets omits published versions from a new release plan.
