# Releases

## One-time setup

1. Push the prepared source to `main` in the public GitHub repository. Preparing
   these local files does not publish anything or run the remote workflow.
2. Enable Actions and allow actions to create PRs in **Settings → Actions → General**.
3. The version job needs `contents`, `issues`, and `pull-requests` write access.
   Publishing needs `packages: write`. Both use the automatic `GITHUB_TOKEN`;
   no personal registry password, Azure PAT, or release PAT is required.
4. **After the first upload, make the GHCR package public:** profile → Packages →
   `leafdock` → Package settings → Change visibility → Public. New GHCR packages
   are private by default, even for public source repos. Public packages can be
   pulled anonymously. The image's source label does not replace this step.
5. Verify a pull without credentials using a temporary empty Docker configuration.

For forks, the owner is derived from `GITHUB_REPOSITORY` and the image name from
`package.json`; update the sample Compose file and README. The repository
name `tool.leafdock` is the product name with a `tool.` prefix.

## First release

The checked-in version and manifest are `1.0.0`. After committing the prepared
files and pushing them, publish the initial version with an explicit tag:

```sh
git tag -a v1.0.0 -m "Leafdock 1.0.0"
git push origin v1.0.0
```

Do not run these until you intend to publish. The tag pipeline runs checks and
then publishes. Tags must match `package.json`. Never overwrite public tags or versions.

## Following releases

1. Use Conventional Commits on `main`: `fix:` bumps patch, `feat:` bumps minor,
   and `feat!:` or `BREAKING CHANGE:` bumps major.
2. After checks, Release Please prepares a PR updating `package.json`, the lockfile,
   changelog, and manifest. Review before merging.
3. The default `GITHUB_TOKEN` cannot trigger another workflow through a bot-created
   PR. If branch protection requires CI, select **Actions → Checks → Run workflow**,
   choose the release PR branch, and wait for it to pass. Regular human-authored
   PRs run checks automatically. Do not bypass branch protection.
4. Merge the release PR. Release Please creates the tag and GitHub release.
   Publication happens in the **same workflow**, avoiding the default-token
   limitation that bot-created tags cannot trigger another workflow.
5. Inspect **Version and publish** and the image digest before announcing it.

Stable `v1.2.3` releases publish `:1.2.3`, `:1.2`, `:1`, and `:latest`. Backports
do not downgrade newer aliases. Prereleases publish only their exact version.
Images target amd64 and arm64 and include source/version/license labels, SBOM,
and provenance. Actions are pinned to verified SHAs; Dependabot proposes weekly
updates for Actions, npm packages, and Docker. Fork PRs cannot publish images.

## Recovery

- Failed CI: fix and rerun. A failing run must not publish.
- Registry errors: verify package access and organization policy, not an Azure PAT.
- Failed publication: rerun the failed job. If the release already exists, rerunning
  Release Please may report no new release. The workflow also supports manual
  dispatch on an existing matching tag, without deleting or replacing that tag.
- Private image: change package visibility; `packages: write` alone is not enough.

References: [GHCR](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry),
[GITHUB_TOKEN](https://docs.github.com/en/actions/tutorials/authenticate-with-github_token),
[Release Please](https://github.com/googleapis/release-please-action).
