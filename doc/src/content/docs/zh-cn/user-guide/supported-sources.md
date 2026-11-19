---
title: 支持的来源
description: 你可以在“添加订阅源”中粘贴哪些内容，以及 Monfil 对每种来源会跟踪什么。
---

选择订阅源栏顶部的 **+**，打开 **添加订阅源**。在输入框中粘贴链接。Monfil 会找到链接背后的订阅源。你不需要知道订阅源的 URL 本身。

输入框下方的芯片用于设置来源类型。保持 **全部** 选中，让 Monfil 根据链接自动检测类型。当 Monfil 无法检测类型，或者你输入的是账号名之类的简短形式时，请选择一个芯片。输入账号名后，按回车键开始检查。

部分链接指向多个订阅源。此时 Monfil 会显示一个列表，并默认选中第一个订阅源。选择你想要的订阅源，然后选择 **继续**。

## 网站和博客

粘贴该网站上任意页面的地址。Monfil 会读取该页面公布的订阅源链接。如果页面没有公布订阅源，Monfil 会尝试同一网站上常见的订阅源地址，例如 `/feed` 和 `/rss.xml`。

## GitHub

| 粘贴 | Monfil 跟踪 |
| --- | --- |
| 代码仓库，例如 `github.com/microsoft/playwright` | 该代码仓库的发布版本 |
| 用户或组织，例如 `github.com/torvalds` | 公开动态 |
| `owner/repo`，并选择 **GitHub** 芯片 | 该代码仓库的发布版本 |

## GitLab

粘贴项目链接，例如 `gitlab.com/gitlab-org/gitlab`。Monfil 会跟踪该项目的发布版本。对于自托管的 GitLab，请先选择 **GitLab** 芯片。

## Hacker News

粘贴 `news.ycombinator.com`。Monfil 会提供以下订阅源：

- **首页**，来自 Hacker News 本身。这是默认选项。
- **100+ points** 和 **300+ points**，只包含达到该分数的故事。
- **Show HN** 和 **Ask HN**。

后四个订阅源来自 [hnrss.org](https://hnrss.org)，这是一项免费服务，不属于 Hacker News。粘贴某个板块的链接，例如 `news.ycombinator.com/show`，只会获取该板块的内容。

## arXiv

粘贴分类列表，例如 `arxiv.org/list/cs.AI/recent`。Monfil 会跟踪该分类的每日公告。它会隐藏已被替换的论文，因为这些是你已经看过的论文的新版本。arXiv 在周末不发布内容。

## 没有账户的 Bluesky 和 Mastodon

你不需要 Bluesky 或 Mastodon 账户，也能关注其中的人。这两个网络都会为每个公开主页提供一个订阅源，Monfil 会直接读取它。请参见[使用场景](../use-cases/#不需要账户也能关注他人)。

## Bluesky

粘贴主页链接，例如 `bsky.app/profile/bsky.app`，或账号名，例如 `@name.bsky.social`。对于使用自定义域名、且不带 `@` 的账号名，请选择 **Bluesky** 芯片。

## Mastodon

粘贴账号名，例如 `@user@mastodon.social`。你也可以粘贴任何服务器上的主页链接或标签链接，例如 `hachyderm.io/@user` 或 `hachyderm.io/tags/rust`。

## YouTube

粘贴频道、账号名、视频或播放列表链接。视频链接会关注发布该视频的频道。

## 开发者会议

选择 **会议** 芯片。输入主题，然后输入 `in`，再输入地点，并按回车键。每个列表中的项目之间用逗号分隔。地点可省略。使用 `online` 表示线上活动。

| 类型 | Monfil 跟踪 |
| --- | --- |
| `devops` | 所有地点的 DevOps 会议 |
| `kubernetes, cloud in France` | 法国的 Kubernetes 或云相关会议 |
| `java in Belgium, online` | 比利时或线上的 Java 会议 |

主题会匹配会议标签，例如 `java` 或 `devops`。Monfil 会将主题中的空格改为连字符，因此 `software testing` 会找到 `software-testing` 标签。地点会匹配城市或国家。

你也可以不选择芯片，直接粘贴 [developers.events](https://developers.events) 链接。请先在网站上设置筛选条件，然后复制地址。Monfil 会使用其中的国家、主题、技术和语言筛选条件。它会忽略地址中的年份，并显示所有年份的会议。如果链接包含其他筛选条件，例如地区，Monfil 会提示你将其移除。

如果没有会议使用你输入的主题或地点，Monfil 会告诉你，并建议接近的匹配项。例如，`test automation` 会建议 `testing`。如果主题和地点都正确，但目前没有匹配的会议，Monfil 也会告诉你。你仍然可以添加该订阅源。当有匹配的会议公布时，它会显示一张卡片。

在以下任一事件发生时，Monfil 会在信息流中添加一张卡片：

- 会议在未来 12 个月内开始。
- 会议的征稿（CFP）开始。
- 会议的征稿在 14 天后结束。
- 会议在 30 天后开始。
- 会议在今天开始。

添加该订阅源时，每个已经发生的事件都会获得一张卡片。Monfil 每次刷新时都会从 developers.events 读取数据。它不会保存完整列表的副本。这些数据采用 [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) 许可，每张卡片都会注明其来源。

## 招聘

选择 **招聘** 芯片。粘贴公司的招聘板，例如 `jobs.lever.co/spotify` 或 `boards.greenhouse.io/datadog`。你也可以粘贴公司的招聘页面。Monfil 会在该页面上查找指向受支持招聘板的链接（此功能可能并非总能成功）。

Monfil 会读取以下系统的公开招聘板：

- Greenhouse
- Lever
- Ashby
- Workable
- SmartRecruiters
- Recruitee
- Teamtailor
- Personio

其他系统（例如 Workday）暂不支持，因此覆盖范围并不完整。

每个在招职位都是一张卡片。卡片会显示公司、地点、工作模式，以及职位发布中注明的薪资（如有）。Monfil 会在可用时从职位发布中读取薪资。

Monfil 会列出公司的所有职位。要只保留你想要的角色，请为每个角色保存一个搜索。请参见[招聘](../jobs/)。

只要保留设置允许，职位就会一直留在信息流中。公司招满后，Monfil 不会删除该职位。

## Substack

粘贴出版物地址，例如 `name.substack.com` 或其自定义域名。Monfil 会找到订阅源。你也可以自行在地址末尾添加 `/feed`。

## Google Alerts

1. 打开 [Google 提醒](https://www.google.com/alerts)，然后创建一个提醒。
2. 选择 **显示选项**。将 **传送到** 设为 **RSS 订阅源**。
3. 选择 **创建提醒**。从提醒列表中复制 RSS 链接，并粘贴到 Monfil 中。

## 不支持的来源

X 不发布订阅源。Reddit 正在停止提供 RSS 订阅源，因此 Monfil 不支持它。
