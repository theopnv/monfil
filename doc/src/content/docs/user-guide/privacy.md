---
title: Privacy notice
description: How the Monfil website and desktop app handle data.
---

Last updated: 23 November 2026.

## Documentation website

This website uses [Cloudflare Web Analytics](https://www.cloudflare.com/web-analytics/) to measure visits and page load performance. The Monfil maintainers use these statistics to improve the documentation and find slow pages.

The analytics reports include page paths, referring sites, country, browser, operating system, device type, and page load times. Your browser loads a script from Cloudflare and sends measurements to Cloudflare. Cloudflare receives your IP address when your browser makes these requests. Its analytics reports do not give the maintainers your IP address.

Cloudflare states that Web Analytics uses no cookies or local storage to collect usage metrics and does not identify visitors through fingerprinting. It does not track visitors across websites. See its [data collection documentation](https://developers.cloudflare.com/web-analytics/data-metrics/data-origin-and-collection/) for details.

Cloudflare keeps unsampled analytics data for seven days, then uses sampled data for longer-term statistics. The dashboard provides access to the previous six months. See the [Web Analytics FAQ](https://developers.cloudflare.com/web-analytics/faq/) for its sampling and report access periods.

Cloudflare, Inc. is based in the United States. Its [privacy policy](https://www.cloudflare.com/privacypolicy/) explains how it handles request data, how long it keeps personal data, and the safeguards it uses for transfers outside the European Economic Area.

### Website hosting and browser storage

Cloudflare hosts this website. Cloudflare receives your IP address and request details when you open a page. See the [Cloudflare privacy policy](https://www.cloudflare.com/privacypolicy/).

The website stores your selected colour theme in your browser's local storage. This setting stays on your device until you change it or clear the site's stored data. It is separate from Cloudflare's analytics.

You can block the Cloudflare script with your browser or a content blocker and continue to read the documentation.

### Privacy questions and rights

The Monfil website maintainer is responsible for this website. For privacy questions or requests about your personal data, email [hello@monfil.app](mailto:hello@monfil.app).

## Desktop app

Monfil is a desktop feed reader. It has no account and no Monfil server. It stores your feeds, saved articles, and read state on your device. Some display settings use local storage. You can find and back up the database in Settings.

### Anonymous usage stats and error reports (optional)

Monfil can send anonymous usage stats and error reports. One setting controls both. Both are off until you agree. The first time you open Monfil, it shows a card with two equal buttons, **Share stats and reports** and **No thanks**. If you decline or close the card, Monfil asks again after 30 days, and then every 30 days until you agree. You can change your choice at any time in **Settings > Privacy**. **See what is sent** shows the summary that Monfil would send today and a sample error report.

#### Usage stats

If you agree, Monfil counts on your device what you do. Once a day it sends one `daily_summary` event for each day you used the app. When you agree, it also sends one `consent_granted` event with no data. The `daily_summary` event holds:

- Counts for the day: articles opened, full-text extractions, feeds added, feeds removed, manual refreshes, items saved, feedpacks installed, OPML files imported, OPML files exported, backups made, workspaces created, workspaces switched, searches, and embeds loaded.
- Counts of failures for the day: feed refresh failures, article extraction failures, internal request failures, and interface failures. Feed refresh failures are also counted by cause: timeout, HTTP 4xx, HTTP 5xx, TLS, DNS, parse, or too large. These are numbers only. They carry no error text.
- How the app started: whether it started, and in which time range it showed the first articles (under 1 second, 1 to 3 seconds, 3 to 10 seconds, or over 10 seconds).
- How adding a feed went: the number of attempts and successes, and the number of failures by cause: no feed found, network, parse, or not supported.
- The state of your library: a size range for your feeds (`0`, `1-5`, `6-20`, `21-100`, or `100+`), the number of workspaces, the number of folders, and the types of feed you use, such as `rss+youtube`.
- Your display settings: density, theme, the language of the Monfil interface, whether read items are hidden, whether items are marked read on scroll, whether links open in your browser, and whether keyboard navigation is on.
- The day it covers, the Monfil version, your operating system and its version, your language setting, and the version of the web engine in Monfil.

The event never holds a feed name, a link, article text, search text, or a name for you. Monfil sends no identifier that lasts. Each request uses a new random session ID.

[Aptabase](https://aptabase.com) receives the events. Technov Solutions SRL, a company based in Bucharest, Romania, runs Aptabase. It acts as the processor for the Monfil maintainer under its [data processing agreement](https://aptabase.com/legal/dpa). Monfil uses the EU region (`eu.aptabase.com`). Aptabase states that it processes and stores the data of EU-region accounts only within the European Union.

Aptabase derives an anonymous user ID on its server as a hash of your IP address and user agent with a salt. Aptabase states that the salt is different for each app and is discarded every 24 hours. The ID changes every day, so the maintainer cannot follow one person from one day to the next. Aptabase states that it keeps analytics data for up to 5 years. See the [Aptabase privacy policy](https://aptabase.com/legal/privacy) for details.

#### Error reports

If you agree, Monfil sends a report when something fails, such as an error in the app, a failed update, a database recovery, or a crash. A report holds:

- The error type, the error message, and the stack trace, which lists places in the Monfil code.
- A short incident ID, which is the same ID that the error screen shows, and the part of the app that failed, for example the name of an internal request.
- A short trail of the last Monfil events before the failure. It holds event names and fixed choices, such as `outcome: failed`. It never holds a feed name, a link, or an ID of a feed or an article.
- The Monfil version, whether the build comes from GitHub or from a store, your operating system and its version, your processor type, and the versions of the web engine and of Node.js in Monfil.
- Session data that tells how many sessions end without a crash: when the session started, how long it lasted, and whether it ended well.

Before Monfil sends a report, it removes file paths from the error text (your home folder becomes `~`), links, and email addresses. It sends only the fields in the list above and drops the rest. A report holds no feed name, link, article text, search text, user name, or IP address that Monfil adds. **See what is sent** shows a sample report that Monfil builds on your device from a made-up failure.

If Monfil crashes at a low level, it also sends a crash dump. A crash dump is a snapshot of the memory of the process that crashed. Memory can hold pieces of what the app was showing, such as an article title. Monfil cannot remove them.

After a failure, you can add details to the report. The comment is optional, and you write it. The log file is attached only if you tick **Attach the log file**, and you can preview it before you send it. The log file holds the event records of Monfil, with feed names, full links, article text, credentials, and file paths removed. It can still show the host names of sites and error codes. Monfil attaches the last megabyte of it. A native error window, which has no text field, offers only the log file.

[Sentry](https://sentry.io) receives the reports. Functional Software, Inc., a company based in the United States, runs Sentry. It acts as the processor for the Monfil maintainer under its [data processing agreement](https://sentry.io/legal/dpa/). Monfil uses the EU region (`de.sentry.io`), where Sentry stores the data in Germany. Sentry receives your IP address with each request, and the Monfil project is set not to store it. Sentry keeps error reports for 30 days. The maintainer receives an email when a new problem appears.

#### Your choice

The legal basis is your consent. Your choice is stored on your device with its date and the version of this notice. To withdraw, turn off **Share anonymous usage stats and error reports** in Settings. Monfil then stops counting, stops sending, and deletes the counts, the reports that wait to be sent, and the crash dumps that it kept on your device. Reports already received cannot be linked back to you, unless you send the incident ID of a report to the maintainer. To ask about your data, email [hello@monfil.app](mailto:hello@monfil.app). A build of Monfil that has no analytics key and no error report address, such as a build you compile yourself, sends nothing.

### Requests to other sites

Monfil requests feeds from their publishers when it refreshes them. Opening an article can make Monfil request the publisher's page to get its full text. Images and feed icons can load from remote sites when they appear on screen. Those sites receive the request and can see information such as your IP address and app or browser details.

When you add a feed, Monfil can request the page you pasted and common feed addresses on the same site. For a Hacker News link, it checks feeds on [hnrss.org](https://hnrss.org). To show an icon for a GitLab project or a Bluesky profile, it asks the GitLab API or the Bluesky public API for the avatar. A conference feed requests the event list from [developers.events](https://developers.events) when you add it and at each refresh. GitHub Pages hosts that list.

Opening an article or other link in your browser also connects to the linked site. That browser uses its own privacy settings.

### Embedded media

Monfil supports embeds from YouTube, X, Vimeo, Instagram, and Spotify. It shows a card first. Monfil creates the provider's embedded frame only after you click **Load** on that card. Each embed needs its own click each time you open the article. You can read the article without loading the embed.

When you load an embed, your device connects to its provider. The provider receives a request for that video, post, or audio item. It can see your IP address and app or browser details. It may use cookies or other storage in its frame. Monfil does not control the provider's data practices. The **Open on** link connects to the provider in your browser if you click it.

Loading an embed does not stop the article's images or feed icons from loading from their own sites.

Provider privacy policies: [YouTube (Google)](https://policies.google.com/privacy), [X](https://x.com/en/privacy), [Vimeo](https://vimeo.com/legal/privacy), [Instagram (Meta)](https://www.facebook.com/privacy/policy/), and [Spotify](https://www.spotify.com/legal/privacy-policy/).
