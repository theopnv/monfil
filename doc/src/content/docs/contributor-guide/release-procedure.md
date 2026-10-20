---
title: Release procedure
description: Build and publish a Monfil release.
sidebar:
  order: 11
---

Merging a PR into `main` starts delivery. The `.github/workflows/version.yml` workflow uses semantic-release to read all commits since the last version tag. Electron Forge's makers are configured in `forge.config.ts`.

## Write commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) for PR commits. The required `lint` check runs commitlint on those commits.

| Commit | Version increase |
| --- | --- |
| `fix: correct feed parsing` | Patch |
| `perf: reduce refresh work` | Patch |
| `feat: add a feed source` | Minor |
| `feat!: change the feed contract` | Major |
| A commit with a `BREAKING CHANGE:` or `BREAKING-CHANGE:` footer | Major |
| `docs:`, `test:`, `ci:`, and other types without a breaking change | None |

The largest required increase wins. If the commits require no increase, the workflow leaves the version and tags unchanged. Use the same message format for squash commits.

## Configure the release credential

Add a repository secret named `RELEASE_TOKEN` with a fine-grained personal access token from a repository administrator. Limit access to this repository and grant **Contents: Read and write**. The administrator must have permission to bypass the `main` rule that requires a PR. Replace the token before it expires.

This token lets semantic-release push the version commit directly to `main`. A tag pushed with this token starts the publish workflow. The built-in `GITHUB_TOKEN` suppresses workflows triggered by its own pushes.

## Build and publish

semantic-release updates `package.json` and `package-lock.json`, commits them to `main`, and pushes a matching tag such as `v1.2.3`. The release commit uses the message `chore(release): 1.2.3`.

The `.github/workflows/publish.yml` workflow checks that the tag matches the package version. It runs the full test matrix and builds installers on Linux, macOS, and Windows. Each successful e2e job uploads the app package that it built. The installer job restores that package and runs Forge with `--skip-package`. Publication starts after all builds succeed. The GitHub release is public without an operator action.

The Windows build also makes an unsigned MSIX package for the Microsoft Store. The GitHub release does not include it. After publication, the `store` job sends it to Partner Center with the Microsoft Store CLI. The Store signs and certifies the package before users get it.

The documentation workflow runs after publication to update the changelog. Cleanup runs only after successful publication. It keeps the latest three stable releases and the latest three pre-releases. Git tags stay available.

If a publish run fails, correct the failure and rerun the failed jobs for that tag. Uploads can replace existing assets during a rerun. The version workflow can also be started manually after a credential or infrastructure failure.

## Configure the Microsoft Store submission

The `store` job runs only when the repository variable `MSSTORE_PRODUCT_ID` exists. Do the first submission by hand in Partner Center. Then configure the job:

1. In Partner Center, open **Product identity** and copy the package identity name, the publisher, and the publisher display name into the `MakerMSIX` options in `forge.config.ts`.
2. In Partner Center, open **Account settings** > **User management** > **Microsoft Entra applications**. Add an application with the **Manager** role and create a key for it.
3. Add these repository secrets: `PARTNER_CENTER_TENANT_ID`, `PARTNER_CENTER_SELLER_ID`, `PARTNER_CENTER_CLIENT_ID`, and `PARTNER_CENTER_CLIENT_SECRET`.
4. Add the repository variable `MSSTORE_PRODUCT_ID` with the Store ID of the app, for example `9NXXXXXXXXXX`.

Partner Center accepts one pending submission at a time. If the `store` job fails because a submission is still in certification, wait for certification to finish and rerun the job. Replace the client secret before it expires.

## Application updates

The Windows setup file installs a copy of Monfil that updates itself. Monfil reads `update.electronjs.org`, which serves the Squirrel files of the latest public GitHub release. Monfil downloads an update in the background and offers a restart when the update is ready. A Store copy gets its updates from the Store and does not check GitHub.

`src/main/updates/update-source.ts` selects the update source for each platform. macOS needs a signed app before it can update itself. Linux packages do not have an Electron updater.
