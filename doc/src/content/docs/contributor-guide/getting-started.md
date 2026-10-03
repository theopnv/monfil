---
title: Getting started
description: Set up Monfil and send your first change.
sidebar:
  order: 2
---

You need Git, GitHub access, Node.js, and npm.

## Run the app

Fork the [Monfil repository](https://github.com/theopnv/monfil), clone your fork, and make a branch. Replace `YOUR_ACCOUNT` with your GitHub name:

```sh
git clone https://github.com/YOUR_ACCOUNT/monfil.git
cd monfil
git switch -c my-first-change
npm install
npm start
```

Electron Forge starts the main process and renderer development server. Development uses a separate data directory, so your installed app's database stays untouched.

## Send a small change

For a first pull request, choose an issue or a documentation error that you can check against the code. Discuss larger changes in a GitHub issue before you start.

1. Make the change. Run the checks that apply to it.
2. Commit and push your branch.
3. Open a pull request against the official repository. Describe the behavior, your change, and the checks you ran. Link an issue when there is one.
4. Sign the [Contributor License Agreement](https://github.com/theopnv/monfil/blob/main/CLA.md) through the link from CLA Assistant.

For a code change, run `npm run lint` and the affected tests. `npm test` runs all suites. For a documentation change, run `npm run lint:docs` and `npm --prefix doc run build`.

:::tip[Debug both processes]
In VS Code, the `Main + renderer` launch configuration attaches debuggers to both Electron processes.
:::

## Recommended setup

- Claude or Codex can help understanding the codebase and write new features and fixes.
- [Graft](https://github.com/trailhq/Graft) can help navigating the codebase.
- Install [Husky](https://typicode.github.io/husky/get-started.html) to get pre-commit hooks support (lint).
