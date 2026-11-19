---
title: 隐私声明
description: Monfil 网站和桌面应用如何处理数据。
---

:::note
本译文为机器草稿。如有差异，请以[英文版本](../../../user-guide/privacy/)为准。
:::

最后更新：2026 年 10 月 23 日。

## 文档网站

本网站使用 [Cloudflare Web Analytics](https://www.cloudflare.com/web-analytics/) 统计访问量和页面加载性能。Monfil 维护者使用这些统计数据改进文档，并找出加载缓慢的页面。

分析报告包括页面路径、来源网站、国家或地区、浏览器、操作系统、设备类型和页面加载时间。你的浏览器会从 Cloudflare 加载一个脚本，并将测量数据发送给 Cloudflare。你的浏览器发出这些请求时，Cloudflare 会收到你的 IP 地址。其分析报告不会向维护者提供你的 IP 地址。

Cloudflare 表示，Web Analytics 不使用 Cookie 或本地存储来收集使用指标，也不通过指纹识别访问者。它不会跨网站追踪访问者。详情请参见其[数据收集文档](https://developers.cloudflare.com/web-analytics/data-metrics/data-origin-and-collection/)。

Cloudflare 会将未采样的分析数据保留七天，之后使用采样数据生成长期统计。仪表板可查看过去六个月的数据。关于采样和报告访问期限，请参见 [Web Analytics 常见问题](https://developers.cloudflare.com/web-analytics/faq/)。

Cloudflare, Inc. 总部位于美国。其[隐私政策](https://www.cloudflare.com/privacypolicy/)说明了它如何处理请求数据、保留个人数据的时间，以及向欧洲经济区以外传输数据时采取的保障措施。

### 网站托管和浏览器存储

Cloudflare 托管本网站。你打开页面时，Cloudflare 会收到你的 IP 地址和请求详情。请参见 [Cloudflare 隐私政策](https://www.cloudflare.com/privacypolicy/)。

本网站会将你选择的颜色主题存储在浏览器的本地存储中。该设置会保留在你的设备上，直到你更改它或清除该网站的存储数据。它与 Cloudflare 的分析无关。

你可以使用浏览器或内容拦截器屏蔽 Cloudflare 脚本，并继续阅读文档。

### 隐私问题和权利

Monfil 网站的维护者负责本网站。如有隐私问题，或有关于你个人数据的请求，请发送电子邮件至 [hello@monfil.app](mailto:hello@monfil.app)。

## 桌面应用

Monfil 是一款桌面订阅阅读器。它没有账户，也没有 Monfil 服务器。它会将你的订阅源、已保存的文章和阅读状态存储在你的设备上。部分显示设置会使用本地存储。你可以在设置中查找数据库并备份。

### 匿名使用统计（可选）

Monfil 可以发送匿名使用统计。在你同意之前，该功能处于关闭状态。在你添加订阅源并打开应用两次后，Monfil 会显示一张卡片，上面有两个同等大小的按钮：**分享使用统计** 和 **不用了，谢谢**。关闭卡片后，Monfil 会稍后再次询问，之后最多再询问一次，间隔为 14 天。你可以随时在 **设置 > 隐私** 中更改选择。**查看发送内容** 会显示 Monfil 今天会发送的摘要。

如果你同意，Monfil 会在你的设备上统计你的操作。Monfil 每天会发送一次 `daily_summary` 事件，对应你使用应用的每一天。当你同意时，它还会发送一次不含任何数据的 `consent_granted` 事件。`daily_summary` 事件包含以下内容：

- 当天的计数：打开的文章、全文提取、添加的订阅源、移除的订阅源、手动刷新、保存的项目、安装的 Feedpack、导入的 OPML 文件、导出的 OPML 文件、完成的备份、创建的 Workspace、切换的 Workspace、搜索和加载的嵌入内容。
- 当天的失败计数：订阅源刷新失败、文章提取失败、内部请求失败和界面失败。这些只是数字，不包含错误文本。
- 你的库状态：订阅源数量范围（`0`、`1-5`、`6-20`、`21-100` 或 `100+`）、Workspace 数量、文件夹数量，以及你使用的订阅源类型，例如 `rss+youtube`。
- 你的显示设置：密度、主题、Monfil 界面语言、是否隐藏已读项目、滚动时是否标为已读、链接是否在浏览器中打开，以及键盘导航是否开启。
- 该事件涵盖的日期、Monfil 版本、你的操作系统及其版本、你的语言设置，以及 Monfil 中网页引擎的版本。

该事件从不包含订阅源名称、链接、文章文本、搜索文本或你的名称。Monfil 不会发送任何持久标识符。每个请求都使用新的随机会话 ID。

[Aptabase](https://aptabase.com) 接收这些事件。Technov Solutions SRL 是一家位于罗马尼亚布加勒斯特的公司，负责运营 Aptabase。根据其[数据处理协议](https://aptabase.com/legal/dpa)，它作为 Monfil 维护者的处理者行事。Monfil 使用欧盟地区（`eu.aptabase.com`）。Aptabase 表示，它仅在欧盟境内处理和存储欧盟地区账户的数据。

Aptabase 会在其服务器上，根据你的 IP 地址和用户代理加盐后取哈希值，生成匿名用户 ID。Aptabase 表示，每个应用的盐值各不相同，并每 24 小时丢弃一次。该 ID 每天都会变化，因此维护者无法追踪同一个人从一天到下一天的行为。Aptabase 表示，它最多保留分析数据 5 年。详情请参见 [Aptabase 隐私政策](https://aptabase.com/legal/privacy)。

法律依据是你的同意。你的选择会连同日期和本声明的版本，存储在你的设备上。如要撤回同意，请关闭设置中的 **分享匿名使用统计**。此后，Monfil 会停止计数和发送，并删除它在你设备上保存的计数。已接收的事件无法再与你关联。如要询问你的数据，请发送电子邮件至 [hello@monfil.app](mailto:hello@monfil.app)。没有分析密钥的 Monfil 版本（例如你自行编译的版本）不会发送任何数据。

### 向其他网站发出的请求

Monfil 在刷新订阅源时，会向其发布者请求订阅源内容。打开文章时，Monfil 可能会请求发布者的页面，以获取全文。图片和订阅源图标在屏幕上显示时，可能会从远程网站加载。这些网站会收到请求，并可以看到你的 IP 地址以及应用或浏览器的详细信息等信息。

添加订阅源时，Monfil 可能会请求你粘贴的页面，以及同一网站上常见的订阅源地址。对于 Hacker News 链接，它会检查 [hnrss.org](https://hnrss.org) 上的订阅源。为显示 GitLab 项目或 Bluesky 主页的图标，它会向 GitLab API 或 Bluesky 公共 API 请求头像。会议订阅源会在你添加时以及每次刷新时，从 [developers.events](https://developers.events) 请求活动列表。该列表由 GitHub Pages 托管。

在浏览器中打开文章或其他链接时，也会连接到该链接的网站。该浏览器使用其自己的隐私设置。

### 嵌入的媒体

Monfil 支持嵌入 YouTube、X、Vimeo、Instagram 和 Spotify 的内容。它会先显示一张卡片。只有当你点击该卡片上的 **加载** 后，Monfil 才会创建提供方的嵌入框架。每次打开文章时，每个嵌入内容都需要你重新点击一次。你可以在不加载嵌入内容的情况下阅读文章。

加载嵌入内容时，你的设备会连接到其提供方。提供方会收到该视频、帖子或音频条目的请求。它可以看到你的 IP 地址以及应用或浏览器的详细信息。它可能会在其框架中使用 Cookie 或其他存储。Monfil 无法控制提供方的数据处理做法。如果你点击 **在以下平台打开**，则会在浏览器中连接到该提供方。

加载嵌入内容不会阻止文章中的图片或订阅源图标从其各自的网站加载。

提供方隐私政策：[YouTube（Google）](https://policies.google.com/privacy)、[X](https://x.com/en/privacy)、[Vimeo](https://vimeo.com/legal/privacy)、[Instagram（Meta）](https://www.facebook.com/privacy/policy/) 和 [Spotify](https://www.spotify.com/legal/privacy-policy/)。
