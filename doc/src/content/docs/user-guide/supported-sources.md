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

## Substack

Paste the publication address, such as `name.substack.com` or its custom domain. Monfil finds the feed. You can also add `/feed` at the end of the address yourself.

## Google Alerts

1. Open [Google Alerts](https://www.google.com/alerts) and create an alert.
2. Select **Show options**. Set **Deliver to** to **RSS feed**.
3. Select **Create alert**. Copy the RSS link from the alert list and paste it in Monfil.

## Sources that do not work

X and Reddit do not publish feeds that Monfil can read.
