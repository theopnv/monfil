---
title: Release procedure
description: Build and publish a Monfil release.
sidebar:
  order: 11
---

This procedure is for maintainers who can push tags and publish releases in the official repository. The [publish workflow](https://github.com/theopnv/monfil/blob/main/.github/workflows/publish.yml) runs the release. Electron Forge's makers and GitHub publisher are in the [build configuration](https://github.com/theopnv/monfil/blob/main/forge.config.ts).

## Prepare the release

1. Set the version in the [package metadata](https://github.com/theopnv/monfil/blob/main/package.json) and commit it.
2. Create a matching tag, such as `v1.2.3`, and push it (`git tag v1.2.3 && git push origin v1.2.3`). The workflow stops if the tag and package version differ.

:::caution[Check the version]
Use the same version in the tag and package metadata before you push. A pushed tag starts the publish workflow.
:::

## Review and publish

The workflow runs tests on Linux, macOS, and Windows. It then builds the platform artifacts and uploads them to a draft GitHub release.

Open the draft. Download and test its artifacts, and check that each expected platform file is present. Publish the draft after this review. GitHub changes its visibility at that point; the workflow does not rebuild the files.
