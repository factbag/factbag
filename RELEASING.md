# Releasing Factbag

Only `factbag` is published. Component packages, widgets, examples, tooling, and the repository root remain private.

## Release changes

1. Include a changeset with each user-visible change:

   ```sh
   pnpm changeset
   ```

   Select `factbag`, choose the appropriate bump, and describe the change. Use an empty changeset for changes that require no release.

2. Merge the change PR after CI passes. The **Release** workflow uses Changesets to open or update a `chore: release packages` PR with the version and changelog changes.
3. If GitHub shows **Approve workflows to run** on the release PR, approve its CI runs. Review and merge the release PR once its checks pass.
4. The workflow builds, packs, and tests the versioned package. Confirm the source commit and successful checks, then approve the `npm` environment deployment.
5. Changesets publishes the tested tarball and creates its Git tag and GitHub Release.

The workflow uses Changesets' standard select-mode, version, pack, and publish actions. Only the publish job has OIDC permission. Dependency installation in the version and publish jobs uses the frozen lockfile with install scripts disabled; the publish job performs no build. Your environment approval remains required for publication.

The npm trusted publisher for `publish.yml` and the `npm` environment must allow
direct publishing; no long-lived npm token is required. See [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/).

See [Changesets automation](https://changesets.dev/guide/automating) for the standard workflow and [GitHub's bot-created PR behavior](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow) for CI approval.

## Prereleases

This repository is in Changesets prerelease mode with the `alpha` tag, recorded in `.changeset/pre.json`. Use the normal changeset and release PR flow; do not edit version numbers or changelogs manually. Changesets retains consumed prerelease notes in `.changeset/pre/` for the eventual normal release.

Alpha releases are published under the `alpha` npm tag:

```sh
npm install factbag@alpha
```

To leave prerelease mode, run the following command and merge the resulting state change through a PR:

```sh
pnpm release:pre-exit
```

Changesets then prepares a release PR without the prerelease suffix. Once that PR is merged and publication approved, the normal version is published under `latest`. To start a later alpha cycle, use `pnpm release:pre-enter`.

See [Changesets prereleases](https://changesets.dev/guide/prereleases) for details.

## Dry runs and local checks

Run **Release** manually on `main` with **Verify the release without publishing** enabled. If changesets are pending, it updates the release PR. If a version is ready to publish, it packs the release and verifies its artifact and isolated consumers, then skips publication. If nothing needs releasing, it does nothing. Dry runs do not test npm authentication.

Use `pnpm check && pnpm build:verify` locally to check any checkout, including an already-published version. Use `pnpm release:verify` to pack and test the current Changesets publish plan. Release-only verification requires exactly one unpublished `factbag` version.

## Failed releases

Check npm and the workflow result before retrying; published versions are immutable. Use **Re-run failed jobs** to retain the run's original artifact. Changesets handles publication and tag creation. If publication succeeded but the GitHub Release or tag is missing, recover that metadata against the published source commit rather than changing or republishing the package. Never overwrite an existing release tag.

If the artifact must change, add a changeset and prepare a new release.

## Deprecation

Use `npm deprecate` with a migration message. Do not unpublish except for an immediate security or legal emergency and within npm policy.
