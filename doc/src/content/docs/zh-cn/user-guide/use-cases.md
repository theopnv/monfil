---
title: 使用场景
description: 三个示例设置，分别适用于 DevOps 工程师、创始人和研究人员，帮助他们在各自领域保持领先。
---

这三类人都必须在各自领域保持领先。DevOps 工程师必须第一时间知道技术栈中的工具何时发生变化。创始人必须看到竞争对手发布了什么，以及哪些趋势在增长。研究人员必须在所有人引用新论文之前读到它们。每个人都会创建一个 Workspace，在**添加订阅源**中粘贴几个链接，然后在一个信息流中阅读所有内容。复制一个设置，并根据你的领域进行修改。

要添加来源，请选择订阅源栏顶部的 **+**，然后粘贴链接。Monfil 会找到订阅源。[支持的来源](../supported-sources/)页面列出了每种来源可以粘贴的内容。

## DevOps 工程师

Sam 在一家中型公司领导平台团队。她必须知道技术栈中的工具何时发布新版本，并且必须看到社区本周在讨论什么。她不想每天早上都逐个查看十几个网站。

Sam 创建一个名为 **平台** 的 Workspace，其中包含以下来源：

| 文件夹 | 粘贴 | 获得的内容 |
| --- | --- | --- |
| 发布版本 | `github.com/kubernetes/kubernetes` | 每个 Kubernetes 版本及其发布说明 |
| 发布版本 | `github.com/opentofu/opentofu` | 每个 OpenTofu 版本 |
| 发布版本 | `github.com/argoproj/argo-cd` | 每个 Argo CD 版本 |
| 博客 | `kubernetes.io/blog` | Kubernetes 博客的文章 |
| 博客 | `cncf.io/feed` | CNCF 博客的文章 |
| 社区 | `hachyderm.io/tags/kubernetes` | 带有 `#kubernetes` 标签的 Mastodon 帖子 |
| 社区 | `fosstodon.org/tags/devops` | 带有 `#devops` 标签的 Mastodon 帖子 |
| 社区 | 为 Sam 信任的每位工程师添加 `@user@hachyderm.io` | 该人员的帖子 |

Sam 没有 Mastodon 账户。Monfil 会读取标签和人员的公开订阅源，因此她不需要账户。

发布说明会以完整项目的形式出现，因此 Sam 无需打开 GitHub 就能阅读有哪些变化。当某个次要版本包含破坏性变更时，Sam 会保存该项目，并将其链接到升级工单中。

**提示：**平台工程 Feedpack 已经包含 Kubernetes、OpenTofu、Helm 以及其他工具的发布版本。安装它，然后添加你自己的工具。

## 创始人

Alex 独自构建一款开源网站分析产品。他必须看到竞争对手发布了什么，并且必须尽早发现趋势。他的时间有限，因此只有强烈的信号才会进入 Workspace。

Alex 创建一个名为 **市场** 的 Workspace，其中包含以下来源：

| 文件夹 | 粘贴 | 获得的内容 |
| --- | --- | --- |
| 竞争对手 | `github.com/plausible/analytics` | 每个 Plausible 版本 |
| 竞争对手 | `github.com/umami-software/umami` | 每个 Umami 版本 |
| 竞争对手 | 每个竞争对手的博客 | 他们的发布文章和公告 |
| 趋势 | `news.ycombinator.com`，然后选择 **300+ points** | 只包含达到 300 分的故事 |
| 趋势 | `news.ycombinator.com`，然后选择 **Show HN** | 其他开发者发布的新产品 |
| 提及 | 产品名称的 Google Alerts 订阅源 | 提及该产品名称的新页面 |
| 人物 | 同一领域创始人的 `@name.bsky.social` | 他们在 Bluesky 上的帖子 |

Hacker News 提供多个订阅源可供选择。Alex 会选择一个分数门槛，因此信息流显示的是最受讨论的故事，而不是完整的内容流。对于 Google Alerts，[支持的来源](../supported-sources/#google-alerts)页面说明了如何获取订阅源。

竞争对手发布的、属于 Alex 路线图中的功能，会在当天进入信息流。他不需要 Bluesky 账户就能关注这些创始人。

**提示：**Founders & Solopreneurs Feedpack 已经包含 **Show HN** 和 **300+ points** 订阅源。安装它，然后添加你的竞争对手。

## 研究人员

Priya 在大学实验室研究语言模型。她必须每天阅读几个类别中的新论文。她还想知道实验室使用的库何时发生变化，以及其他研究人员对新论文有什么看法。

Priya 创建一个名为 **研究** 的 Workspace，其中包含以下来源：

| 文件夹 | 粘贴 | 获得的内容 |
| --- | --- | --- |
| 论文 | `arxiv.org/list/cs.CL/recent` | 计算语言学领域的新论文 |
| 论文 | `arxiv.org/list/cs.LG/recent` | 机器学习领域的新论文 |
| 库 | `github.com/huggingface/transformers` | 每个 Transformers 版本 |
| 库 | `github.com/pytorch/pytorch` | 每个 PyTorch 版本 |
| 实验室 | `huggingface.co/blog` | Hugging Face 博客的文章 |
| 人物 | Priya 关注的每位研究人员的 Bluesky 主页 | 他们的帖子和论文讨论串 |

Monfil 会隐藏 arXiv 中已被替换论文的公告，因此旧论文的新版本不会再次出现。arXiv 在周末不发布内容，因此信息流在周六和周日会比较安静。

Priya 使用搜索查找各个类别中关于同一主题的所有论文。她会将论文保存到 **已保存** 列表中，以便稍后阅读。

**提示：**AI Feedpack 已经包含 `cs.AI`、`cs.LG` 和 `cs.CL` 分类，以及关键 AI 库的发布版本。

## 不需要账户也能关注他人

Bluesky 和 Mastodon 会为每个公开主页发布一个订阅源。Mastodon 还会为服务器上的每个标签发布一个订阅源。Monfil 会直接读取这些订阅源：

- 你不需要在这两个网络上拥有账户、应用或登录。
- 帖子会与你信息流中的其他来源一同出现。没有推荐内容，也没有点赞数。
- Monfil 只读取公开帖子。它无法显示需要登录才能查看的帖子，例如仅粉丝可见的帖子。

要关注某人，请粘贴其主页链接或账号名。Bluesky 请使用 `@name.bsky.social`，Mastodon 请使用 `@user@server`，然后按回车键。
