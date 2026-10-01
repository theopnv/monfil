---
title: Getting started
description: Set up Monfil and send your first change.
sidebar:
  order: 2
---

You need Git, GitHub access, Node.js and npm.

## Run the app

Fork the [Monfil repository](https://github.com/theopnv/monfil). Clone your fork, then make a branch. Replace `YOUR_ACCOUNT` with your GitHub name:

```sh
git clone https://github.com/YOUR_ACCOUNT/monfil.git
cd monfil
git switch -c my-first-change
```

From the repository root:

```sh
npm install
npm start
```

Electron Forge starts the main process and the renderer dev server. The app uses a separate data directory in development, so a development run does not use the installed app's database.

## Make one small change

For a first pull request, choose a small issue or a documentation error you can check against the code. For a large change, open a GitHub issue so we can discuss it before you spend time on it.

1. Make the change and run the checks that apply:

    ```sh
    # For code changes only
    npm run lint
    npm run test # Or npm run test:unit && npm run test:integration && npm run test:e2e

    # For docs changes only
    npm run lint:docs
    npm --prefix doc run build
    ```

2. Run the lint and tests (depending on your change you might not need all of them).
3. Commit and push your branch.
4. Open a pull request against the official repository. Describe the behavior, your change, and the checks you ran. Link the issue when there is one. The maintainer reviews the pull request and may ask for changes.
5. Sign the agreement linked by the CLA Assistant ([Contributor License Agreement](https://github.com/theopnv/monfil/blob/main/CLA.md)).

If you need debugging, the VS Code `Main + renderer` launch configuration attaches debuggers to both Electron processes.

## Recommended setup

- Claude or Codex can help understanding the codebase and write new features and fixes.
- [Graft](https://github.com/trailhq/Graft) can help navigating the codebase.
- Install [Husky](https://typicode.github.io/husky/get-started.html) to get pre-commit hooks support (lint).
