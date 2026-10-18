---
title: Supported sources
description: What you can paste in Add Feed, and what Monfil follows for each source.
---

Select **+** at the top of the feed sidebar to open **Add Feed**. Paste a link in the box. Monfil finds the feed behind the link. You do not need the feed URL itself.

The chips under the box set the source type. Keep **Anything** to let Monfil detect the type from the link. Pick a chip when Monfil cannot detect it, or when you type a short form such as a handle. For a handle, press Enter to start the check.

Some links lead to more than one feed. Then Monfil shows a list and selects the first feed. Select the one you want, then select **Continue**.

## Websites and blogs

Paste the address of any page on the site. Monfil reads the feed links that the page advertises. If the page has none, Monfil tries common feed addresses on the same site, such as `/feed` and `/rss.xml`.

## GitHub

| Paste | Monfil follows |
| --- | --- |
| A repository, such as `github.com/microsoft/playwright` | The repository releases |
| A user or an organization, such as `github.com/torvalds` | The public activity |
| `owner/repo`, with the **GitHub** chip | The repository releases |

## GitLab

Paste a project link, such as `gitlab.com/gitlab-org/gitlab`. Monfil follows the project releases. For a self-hosted GitLab, pick the **GitLab** chip first.

## Hacker News

Paste `news.ycombinator.com`. Monfil offers these feeds:

- **Front page**, from Hacker News itself. This is the default.
- **100+ points** and **300+ points**, with only the stories that reach that score.
- **Show HN** and **Ask HN**.

The last four come from [hnrss.org](https://hnrss.org), a free service that is not part of Hacker News. A link to a section, such as `news.ycombinator.com/show`, gives that section only.

## arXiv

Paste a category listing, such as `arxiv.org/list/cs.AI/recent`. Monfil follows the daily announcements for that category. It hides replaced papers, because they are new versions of papers that you already saw. arXiv does not publish on weekends.

## Bluesky and Mastodon without an account

You do not need a Bluesky or Mastodon account to follow people there. Both networks publish a feed for each public profile, and Monfil reads it. See [Use cases](../use-cases/#follow-people-without-an-account).

## Bluesky

Paste a profile link, such as `bsky.app/profile/bsky.app`, or a handle, such as `@name.bsky.social`. For a handle on a custom domain without the `@`, pick the **Bluesky** chip.

## Mastodon

Paste a handle, such as `@user@mastodon.social`. You can also paste a profile link or a tag link from any server, such as `hachyderm.io/@user` or `hachyderm.io/tags/rust`.

## YouTube

Paste a channel, a handle, a video, or a playlist link. A video link follows the channel that posted it.

## Developer Conferences

Pick the **Conferences** chip. Type topics, then `in`, then places, and press Enter. Separate the items in each list with commas. Places are optional. Use `online` for online events.

| Type | Monfil follows |
| --- | --- |
| `devops` | DevOps conferences in all places |
| `kubernetes, cloud in France` | Kubernetes or cloud conferences in France |
| `java in Belgium, online` | Java conferences in Belgium or online |

A topic matches a conference tag, such as `java` or `devops`. Monfil changes spaces in a topic to hyphens, so `software testing` finds the `software-testing` tag. A place matches a city or a country.

You can also paste a [developers.events](https://developers.events) link without the chip. Set the filters on the site first, then copy the address. Monfil uses the country, topic, tech, and language filters. It ignores the year in the address and shows conferences in all years. If the link has another filter, such as region, Monfil tells you to remove it.

If no conference uses a topic or a place, Monfil tells you and suggests close matches. For example, `test automation` suggests `testing`. If the topic and the place are correct but no conference matches now, Monfil tells you so. You can still add the feed. It shows a card when a matching conference is announced.

Monfil adds a card to the river when one of these events occurs:

- A conference starts in the next 12 months.
- Its call for papers (CFP) opens.
- Its CFP closes in 14 days.
- It starts in 30 days.
- It starts today.

When you add the feed, you get a card for each event that has already occurred. Monfil reads the data from developers.events each time it refreshes. It does not keep a copy of the full list. The data has the [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) licence, and each card names its source.

## Substack

Paste the publication address, such as `name.substack.com` or its custom domain. Monfil finds the feed. You can also add `/feed` at the end of the address yourself.

## Google Alerts

1. Open [Google Alerts](https://www.google.com/alerts) and create an alert.
2. Select **Show options**. Set **Deliver to** to **RSS feed**.
3. Select **Create alert**. Copy the RSS link from the alert list and paste it in Monfil.

## Sources that do not work

X does not publish feeds. Reddit is ending its RSS feeds, so Monfil does not support it.
