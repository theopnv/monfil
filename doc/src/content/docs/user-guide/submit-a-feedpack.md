---
title: Submit a feedpack
description: Share a collection of feeds with other Monfil readers.
---

A feedpack is a collection of feeds on one subject. You can make one in Monfil and propose it for the feedpack catalog. You need a GitHub account to submit it, but you can use the GitHub website for every step.

You will submit an OPML file with the feeds and update `feedpacks/index.json` to describe the pack. A pull request asks the Monfil maintainer to review those changes. Your pack appears in the catalog after it is accepted.

## 1. Make the pack in Monfil

1. Select **+** in the left rail to create a workspace for the subject. Use **+** at the top of the feed sidebar to add the feeds you want to share. Put them in useful folders.
2. Open each feed. Check that it publishes content and fits the subject. Remove duplicates and broken feeds.
3. Right-click the workspace icon in the left rail and select **Export as OPML**.
4. Save the file with a short name made of lowercase words joined by hyphens, such as `web-performance.opml`.

OPML is the file format Monfil uses to move a list of feeds and folders between apps. The export saves the feeds from that workspace.

## 2. Make a copy of the project on GitHub

1. [Create a GitHub account](https://github.com/signup) if you need one. Sign in and open the [Monfil repository](https://github.com/theopnv/monfil).
2. Select **Fork**, then **Create fork**. GitHub makes a copy under your account. [GitHub's fork guide](https://docs.github.com/en/pull-requests/how-tos/work-with-forks/fork-a-repo) has pictures of these buttons.
3. In your fork, open the branch menu above the file list. It shows **main** at first. Type a name such as `add-web-performance-pack`, then select **Create branch**. A branch holds the changes you want to submit. Keep it selected for both file changes.

## 3. Upload the OPML file

1. In your fork, open the `feedpacks` folder.
2. Select **Add file**, then **Upload files**. Choose the OPML file you exported.
3. Save the change on the branch you created. GitHub may label the button **Commit changes** or **Propose changes**. A commit saves a change to your copy.

## 4. Describe the pack in the catalog

1. Stay in your fork and on the same branch. Open `feedpacks/index.json`, then select the pencil icon to edit it.
2. Add one object inside the `packs` list. Put a comma between your object and the one before it. Use this example as a guide:

```json
{
  "slug": "web-performance",
  "title": "Web Performance",
  "description": "Browser performance, metrics, tooling, and field research.",
  "tags": ["web", "performance", "browsers"],
  "curator": "Your name or handle",
  "sourceCount": 12,
  "updatedAt": "2026-09-30",
  "opml": "web-performance.opml"
}
```

Replace the example values with your own. Make `slug` unique among the existing packs, and make `opml` match your file name exactly. `sourceCount` is the number of feeds, without the folders. Set `updatedAt` to the date when you last checked the sources, in `YYYY-MM-DD` format. Use a short description and a few lowercase search tags. Keep the root `version` value as it is.

Save this change to the same branch as the OPML file.

## 5. Ask for a review

1. Return to the [original Monfil repository](https://github.com/theopnv/monfil). Select **Pull requests**, then **New pull request**.
2. Select **compare across forks**. Set the base repository to `theopnv/monfil` and the base branch to `main`. Set **head fork** to your copy and **compare branch** to the branch you created. [GitHub's pull request guide](https://docs.github.com/en/pull-requests/how-tos/create-pull-requests/creating-a-pull-request-from-a-fork) shows this screen.
3. Check **Files changed**. It should show your OPML file and your edit to `feedpacks/index.json`.
4. Give the request a clear title. In the description, say what the pack covers, how you chose the feeds, and whether any source needs context. Select **Create pull request**.

GitHub runs a check that the OPML file exists and that `sourceCount` matches its feeds. The maintainer reviews the sources, their fit with the subject, and the catalog details. You can reply to questions on the pull request and update the same branch if changes are needed.

Before the pack can be accepted, you must sign the [Contributor License Agreement](https://github.com/theopnv/monfil/blob/main/CLA.md). CLA Assistant adds a link to your pull request. Follow that link to sign.

## If you make the OPML file yourself

Use OPML 2.0. Put each folder in an `<outline>` and each feed inside a folder. Each feed needs a title, a supported `type`, and an `xmlUrl`. You can use an [existing feedpack](https://github.com/theopnv/monfil/tree/main/feedpacks) as an example.

If you work on the project locally, run `npm install` and then `npm run check:feedpacks` before you submit. That command checks the catalog file names and source counts. Open the feeds yourself to check that their URLs work and that the content fits your pack.
