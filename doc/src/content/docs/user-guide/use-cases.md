---
title: Use cases
description: Three example setups to stay ahead in your field, from a DevOps engineer, a founder, and a researcher.
---

These three people must stay ahead in their field. A DevOps engineer must know first when a tool in the stack changes. A founder must see what competitors ship and which trends grow. A researcher must read the new papers before everyone cites them. Each one makes a workspace, pastes a few links in **Add Feed**, and reads everything in one river. Copy a setup, then change it to fit your field.

To add a source, select **+** at the top of the feed sidebar and paste the link. Monfil finds the feed. The [supported sources](../supported-sources/) page lists what you can paste for each source.

## A DevOps engineer

Sam runs the platform team at a mid-size company. She must know when a tool in the stack ships a release, and must see what the community talks about this week. She does not want to check ten sites every morning.

Sam makes a workspace named **Platform** with these sources:

| Folder | Paste | What it gives |
| --- | --- | --- |
| Releases | `github.com/kubernetes/kubernetes` | Each Kubernetes release, with its release notes |
| Releases | `github.com/opentofu/opentofu` | Each OpenTofu release |
| Releases | `github.com/argoproj/argo-cd` | Each Argo CD release |
| Blogs | `kubernetes.io/blog` | Posts from the Kubernetes blog |
| Blogs | `cncf.io/feed` | Posts from the CNCF blog |
| Community | `hachyderm.io/tags/kubernetes` | Mastodon posts with the `#kubernetes` tag |
| Community | `fosstodon.org/tags/devops` | Mastodon posts with the `#devops` tag |
| Community | `@user@hachyderm.io` for each engineer Sam trusts | That person's posts |

Sam has no Mastodon account. Monfil reads the public feeds of the tags and the people, so she does not need one.

Release notes come in as full items, so Sam reads what changed without opening GitHub. When a minor release has a breaking change, Sam saves the item and links it in the upgrade ticket.

**Tip:** the DevSecOps feedpack already has releases for Kubernetes, OpenTofu, Playwright, and other tools. Install it, then add your own tools.

## A founder

Alex builds an open-source web analytics product alone. He must see what competitors ship, and must spot trends early. He has little time, so only strong signals get into the workspace.

Alex makes a workspace named **Market** with these sources:

| Folder | Paste | What it gives |
| --- | --- | --- |
| Competitors | `github.com/plausible/analytics` | Each Plausible release |
| Competitors | `github.com/umami-software/umami` | Each Umami release |
| Competitors | The blog of each competitor | Their launch posts and announcements |
| Trends | `news.ycombinator.com`, then pick **300+ points** | Only the stories that reach 300 points |
| Trends | `news.ycombinator.com`, then pick **Show HN** | What other builders launch |
| Mentions | A Google Alerts feed for the product name | New pages that name the product |
| People | `@name.bsky.social` for founders in the same space | Their posts on Bluesky |

Hacker News gives a choice of feeds. Alex picks a points threshold, so the river shows the stories that most people discussed and not the full stream. For Google Alerts, the [supported sources](../supported-sources/#google-alerts) page shows how to get the feed.

A competitor release that ships a feature from Alex's roadmap comes in the same day. He does not need a Bluesky account to follow the founders.

## A researcher

Priya works on language models in a university lab. She must read the new papers in a few categories every day. She also wants to know when a library the lab uses changes, and what other researchers say about new papers.

Priya makes a workspace named **Research** with these sources:

| Folder | Paste | What it gives |
| --- | --- | --- |
| Papers | `arxiv.org/list/cs.CL/recent` | New papers in Computation and Language |
| Papers | `arxiv.org/list/cs.LG/recent` | New papers in Machine Learning |
| Libraries | `github.com/huggingface/transformers` | Each Transformers release |
| Libraries | `github.com/pytorch/pytorch` | Each PyTorch release |
| Labs | `huggingface.co/blog` | Posts from the Hugging Face blog |
| People | The Bluesky profile of each researcher Priya follows | Their posts and paper threads |

Monfil hides the arXiv announcements for replaced papers, so a new version of an old paper does not come in again. arXiv does not publish on weekends, so the river is quiet on Saturday and Sunday.

Priya uses search to find all papers about one topic across the categories. Priya saves the papers to read later in the **Saved** list.

**Tip:** the AI feedpack already has the `cs.AI`, `cs.LG`, and `cs.CL` categories and releases of key AI libraries.

## Follow people without an account

Bluesky and Mastodon publish a feed for each public profile. Mastodon also publishes a feed for each tag on a server. Monfil reads these feeds directly:

- You do not need an account, an app, or a sign-in on either network.
- Posts come in with the other sources in your river. There are no recommendations and no like counts.
- Monfil reads only public posts. It cannot show posts that need a sign-in, such as followers-only posts.

To follow a person, paste their profile link or their handle. Use `@name.bsky.social` for Bluesky and `@user@server` for Mastodon, then press Enter.
