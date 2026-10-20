# Releasing Factbag

Only the `factbag` package is published. The component packages (`@factbag/core`, `@factbag/corpus`, `@factbag/guards`, `@factbag/jev`), widgets, examples, tooling, and the repository root are private workspaces and are never published.

Releases are published from reviewed tarballs to the `latest` dist-tag. The current line is `0.0.0-alpha.N`: every version is a prerelease and APIs may change between any two releases.

## Artifact Verification

Run `pnpm build && pnpm build:verify` to test the current checkout. This packs
`factbag` with pnpm into a temporary directory and checks the tarball and isolated
consumers, regardless of whether its version is already published. CI uses this
path. It does not create or modify the release publish plan.

`pnpm release:verify` instead checks the Changesets publish plan and its exact
tarballs in `.release/`, using the same artifact and consumer checks. An empty
publish plan is an error in this release-only workflow.

## Release Notes

Add a changeset for every user-visible change:

```sh
pnpm changeset
```

Use an empty changeset when a change intentionally requires no release. Changesets only version `factbag`; private workspaces are left untouched.

## Alpha Releases

1. Add and review all required changesets.
2. Set the next version in `packages/factbag/package.json` and move the changeset text into `packages/factbag/CHANGELOG.md` under that version. Changesets cannot compute `0.0.0-alpha.N` versions outside prerelease mode, so this step is manual while the alpha line lasts.
3. Run `pnpm build && pnpm release:verify`. This verifies the artifacts, packs the tarball into `.release/`, and checks the publish plan, tarball contents, and external consumers with and without the optional SDK.
4. Review `.release/publish-plan.json`. It must contain exactly one `factbag` release under the `latest` tag with a matching tarball integrity.
5. Open a pull request with the version change and merge it before publishing.
6. From the merged commit, publish the reviewed tarball:

   ```sh
   pnpm release:publish
   ```

   npm prompts for a one-time password when two-factor authentication is enabled. Changesets creates the `factbag@<version>` git tag; push it with `git push origin --tags`.

7. Verify the registry: `npm view factbag` shows the new version under `latest`, and `npm install factbag` in a clean directory resolves to it.

Do not run `pnpm publish` or `npm publish` directly from a workspace. The Changesets publish plan fixes the package set, dist-tag, and tarball integrity before credentials are used.

## Leaving the Alpha Line

When the API is ready for ordinary semver, run `pnpm release:prepare` with a changeset to produce the first non-prerelease version (for example `0.1.0`), then follow the steps above from step 3. From that point Changesets computes versions and changelogs automatically.

## Deprecation

Use `npm deprecate` with a migration message. Do not unpublish a release except for an immediate security or legal emergency and only within npm policy. During `0.x`, deprecation periods are encouraged but not guaranteed.

## Failed Releases

Published versions are immutable and must never be overwritten.

1. Stop after any unexpected failure.
2. Compare the registry state with `.release/publish-plan.json`.
3. If the reviewed tarball is unchanged, rerun `pnpm release:publish`; an already-published version is skipped.
4. If the artifact must change, bump the version and prepare a new release instead of reusing the failed version.
