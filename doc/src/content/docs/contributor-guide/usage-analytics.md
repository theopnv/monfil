---
title: Usage analytics
description: Add a counter to the opt-in usage stats.
sidebar:
  order: 11
---

Monfil counts feature use on the device and sends one `daily_summary` event for each active day, only when the user opted in. The code lives in [`src/main/analytics`](https://github.com/theopnv/monfil/tree/main/src/main/analytics). Consent is the `usageAnalyticsConsent` setting. Withdrawing consent stops counting at once and deletes the stored counts.

To add a counter, add its name to `MAIN_USAGE_COUNTERS` or `RENDERER_USAGE_COUNTERS` in `src/shared/contracts.ts`. For an action that goes through an invoke channel, map the channel to the counter in `src/main/analytics/channel-counters.ts`. The map counts only after the handler succeeds. For an action that only the renderer sees, call `recordUsage` from `src/renderer/lib/usage.ts`. Then list the new prop in the [privacy notice](../../user-guide/privacy/), update its "Last updated" date, and change `USAGE_ANALYTICS_NOTICE_VERSION` to match. A prop name must stay within 40 characters.

:::caution[Keep the summary anonymous]
A prop holds a count, a bucket, or a fixed choice. Never add a feed name, link, article text, or search text.
:::

The build reads `MONFIL_APTABASE_KEY` and `MONFIL_APTABASE_HOST` from the environment. The key prefix picks the server: `A-EU-` and `A-US-` use the hosted regions, and `A-SH-` uses the host for a self-hosted server. A development build, an end-to-end run, and a build with no key send nothing. An end-to-end spec can point the app at a local stub with `MONFIL_ANALYTICS_ENDPOINT` and shorten the send timer with `MONFIL_ANALYTICS_FLUSH_MS`. Both variables work only when `E2E_TEST` is `1`.
