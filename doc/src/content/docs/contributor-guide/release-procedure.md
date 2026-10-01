---
title: Release procedure
description: Build and publish a Monfil release.
sidebar:
  order: 11
---

This procedure is for maintainers with permission to push tags and publish releases in the official repository. The current workflow is `.github/workflows/publish.yml`; Electron Forge's makers and GitHub publisher are in `forge.config.ts`.

Set the release version in `package.json` and commit the change. Push a tag with `v` followed by that exact version, such as `v1.2.3`. The workflow stops if the tag and package version differ.

The workflow runs the test suite on Linux, macOS, and Windows. It then builds and uploads the platform artifacts to a draft GitHub release. Open the draft release, download and test the artifacts, and check that each expected platform file is present. Publish the draft in GitHub after that review. Publishing changes the release's visibility; the workflow does not rebuild the files at that step.
