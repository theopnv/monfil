---
title: Release procedure
description: Build and publish a Monfil release.
sidebar:
  order: 14
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

## Configure macOS signing

A release signs the macOS app with a Developer ID Application certificate and notarizes it with Apple. `forge.config.ts` signs only when `APPLE_SIGNING_IDENTITY` is set, so a local `npm run package` still makes an unsigned app. Notarization also needs `APPLE_API_KEY`, `APPLE_API_KEY_ID`, and `APPLE_API_ISSUER`.

The e2e job in `.github/workflows/test.yml` packages the app, so it signs and notarizes the app during a release run on macOS. The macOS installer job in `.github/workflows/publish.yml` then signs, notarizes, and staples the DMG. The `.github/actions/apple-signing` action imports the certificate into a temporary keychain in both jobs.

Add these repository variables:

| Variable | Value |
| --- | --- |
| `APPLE_SIGNING_IDENTITY` | The SHA-1 hash or the full name of the certificate, as shown by `security find-identity -v -p codesigning` |
| `APPLE_API_KEY_ID` | The Key ID of the App Store Connect API key |
| `APPLE_API_ISSUER` | The Issuer ID shown above the App Store Connect API keys |

Add these repository secrets:

| Secret | Value |
| --- | --- |
| `APPLE_CERTIFICATE_P12` | The certificate and its private key, exported as `.p12` and encoded in Base64 |
| `APPLE_CERTIFICATE_PASSWORD` | The password of the `.p12` file |
| `APPLE_API_KEY_P8` | The `.p8` API key file, encoded in Base64 |

If `APPLE_SIGNING_IDENTITY` is missing, the release ships an unsigned macOS app. The Developer ID certificate expires after five years. An app signed before the expiry still opens, because notarization adds a secure timestamp.

## Configure the Microsoft Store submission

The `store` job runs only when the repository variable `MSSTORE_PRODUCT_ID` exists and the tag is a minor or major release, such as `v1.3.0`. Patch releases go to GitHub only. Each Store submission needs a new certification, so this rule keeps the number of reviews low.

The job signs in to Partner Center with the repository secrets `PARTNER_CENTER_TENANT_ID`, `PARTNER_CENTER_SELLER_ID`, `PARTNER_CENTER_CLIENT_ID`, and `PARTNER_CENTER_CLIENT_SECRET`. The tenant, seller, and client values are GUIDs. Replace the client secret before it expires.

Partner Center accepts one pending submission at a time. If a submission is still in review, the `store` job skips and shows a notice. The next minor or major release sends the newest version. To send a version sooner, wait for the review to finish and rerun the `store` job.

The Store CLI cannot replace a draft submission that was started in the Partner Center website. If such a draft exists, the `store` job fails and asks you to delete it. Delete the draft in Partner Center and rerun the job.

## Application updates

The Windows setup file and the signed macOS app install a copy of Monfil that updates itself. Monfil reads `update.electronjs.org`, which serves the Squirrel files of the latest public GitHub release. On macOS, it uses the release ZIP, so the release must keep the ZIP next to the DMG. Monfil downloads an update in the background and offers a restart when the update is ready. A Store copy gets its updates from the Store and does not check GitHub.

`src/main/updates/update-source.ts` selects the update source for each platform. Squirrel.Mac accepts only an update signed with the same Developer ID as the running app. Linux packages do not have an Electron updater.
