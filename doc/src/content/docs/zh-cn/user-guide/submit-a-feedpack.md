---
title: 提交 Feedpack
description: 与其他 Monfil 读者分享一组订阅源。
---

Feedpack 是围绕一个主题的一组订阅源。你可以在 Monfil 中创建 Feedpack，并提议将其加入 Feedpack 目录。提交时你需要一个 GitHub 账户，但每一步都可以在 GitHub 网站上完成。

你需要提交一个包含这些订阅源的 OPML 文件，并更新 `feedpacks/index.json` 来描述该 Feedpack。拉取请求会请 Monfil 维护者审核这些更改。你的 Feedpack 被接受后，会出现在目录中。

## 1. 在 Monfil 中创建 Feedpack

1. 选择左侧栏中的 **+**，为该主题创建一个 Workspace。使用订阅源栏顶部的 **+** 添加你想分享的订阅源。将它们放入有用的文件夹。
2. 打开每个订阅源。检查它是否发布内容，并且与该主题相符。删除重复的订阅源和无法使用的订阅源。
3. 右键单击左侧栏中的 Workspace 图标，然后选择 **导出为 OPML**。
4. 保存文件，文件名使用由小写单词组成、以连字符连接的短名称，例如 `web-performance.opml`。

OPML 是 Monfil 用于在应用之间迁移订阅源和文件夹列表的文件格式。导出会保存该 Workspace 中的订阅源。

## 2. 复制项目到 GitHub

1. 如果你还没有 [GitHub 账户](https://github.com/signup)，请先创建一个。登录后，打开 [Monfil 代码仓库](https://github.com/theopnv/monfil)。
2. 选择 **Fork**，然后选择 **Create fork**。GitHub 会在你的账户下创建一份副本。[GitHub 的 Fork 指南](https://docs.github.com/en/pull-requests/how-tos/work-with-forks/fork-a-repo)中有这些按钮的截图。
3. 在你的 Fork 中，打开文件列表上方的分支菜单。它最初显示 **main**。输入一个名称，例如 `add-web-performance-pack`，然后选择 **Create branch**。分支用于保存你想提交的更改。在两次文件更改中都保持选中该分支。

## 3. 上传 OPML 文件

1. 在你的 Fork 中，打开 `feedpacks` 文件夹。
2. 选择 **Add file**，然后选择 **Upload files**。选择你导出的 OPML 文件。
3. 在你创建的分支上保存更改。GitHub 可能会将按钮标为 **Commit changes** 或 **Propose changes**。提交会将更改保存到你的副本中。

## 4. 在目录中描述 Feedpack

1. 留在你的 Fork 中，并保持在同一分支上。打开 `feedpacks/index.json`，然后选择铅笔图标进行编辑。
2. 在 `packs` 列表中添加一个对象。在你的对象与前一个对象之间加一个逗号。可参考以下示例：

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

将示例值替换为你自己的值。`slug` 在现有 Feedpack 中必须唯一，`opml` 必须与你的文件名完全一致。`sourceCount` 是订阅源的数量，不包括文件夹。将 `updatedAt` 设为你最后一次检查来源的日期，格式为 `YYYY-MM-DD`。使用简短的描述和几个小写的搜索标签。保持根级 `version` 的值不变。

将此更改保存到与 OPML 文件相同的分支。

## 5. 请求审核

1. 返回[原始 Monfil 代码仓库](https://github.com/theopnv/monfil)。选择 **Pull requests**，然后选择 **New pull request**。
2. 选择 **compare across forks**。将基础仓库设为 `theopnv/monfil`，基础分支设为 `main`。将 **head fork** 设为你的副本，将 **compare branch** 设为你创建的分支。[GitHub 的拉取请求指南](https://docs.github.com/en/pull-requests/how-tos/create-pull-requests/creating-a-pull-request-from-a-fork)中有此界面的截图。
3. 检查 **Files changed**。其中应显示你的 OPML 文件和你对 `feedpacks/index.json` 的修改。
4. 为请求提供清晰的标题。在描述中，说明该 Feedpack 涵盖什么内容、你如何选择订阅源，以及是否有任何来源需要补充说明。选择 **Create pull request**。

GitHub 会运行检查，确认 OPML 文件存在，并且 `sourceCount` 与其中的订阅源数量一致。维护者会审核来源、它们与主题的契合度，以及目录中的详细信息。你可以在拉取请求中回复问题。如果需要修改，可以在同一分支上更新。

在 Feedpack 被接受之前，你必须签署[贡献者许可协议](https://github.com/theopnv/monfil/blob/main/CLA.md)。CLA Assistant 会在你的拉取请求中添加一个链接。请点击该链接进行签署。

## 如果你自行制作 OPML 文件

使用 OPML 2.0。将每个文件夹放在一个 `<outline>` 中，并将每个订阅源放在文件夹内。每个订阅源都需要标题、受支持的 `type` 和 `xmlUrl`。你可以参考[现有 Feedpack](https://github.com/theopnv/monfil/tree/main/feedpacks) 作为示例。

如果你在本地参与项目，请在提交前运行 `npm install`，然后运行 `npm run check:feedpacks`。该命令会检查目录中的文件名和订阅源数量。请自行打开这些订阅源，确认其 URL 可用，并且内容符合你的 Feedpack 主题。
