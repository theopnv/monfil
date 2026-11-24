---
title: Usage analytics and error reports
description: Add a counter to the opt-in usage stats, and understand the error reports.
sidebar:
  order: 11
---

Monfil counts feature use on the device and sends one `daily_summary` event for each active day, only when the user opted in. The code lives in [`src/main/analytics`](https://github.com/theopnv/monfil/tree/main/src/main/analytics). Consent is the `usageAnalyticsConsent` setting. One setting covers both usage stats and error reports. Withdrawing consent stops counting at once, deletes the stored counts, stops the error reports, and deletes the reports and crash dumps that wait on the device.

The consent card shows at the first run. Then it shows again every 30 days while consent is not `granted`, with no limit on the number of times. Answering the card or closing it both count as a showing. `shouldPromptForUsageAnalytics` in `src/main/analytics/consent.ts` holds the rule.

To add a counter, add its name to `MAIN_USAGE_COUNTERS` or `RENDERER_USAGE_COUNTERS` in `src/shared/contracts.ts`. For an action that goes through an invoke channel, set `counter` on the channel's entry in `src/main/ipc/routes.ts`. The route counts only after the handler succeeds, and a function value may decline to count. For an action that only the renderer sees, call `recordUsage` from `src/renderer/lib/usage.ts`. Then list the new prop in the [privacy notice](../../user-guide/privacy/), update its "Last updated" date, and change `USAGE_ANALYTICS_NOTICE_VERSION` to match. A prop name must stay within 40 characters.

:::caution[Keep the summary anonymous]
A prop holds a count, a bucket, or a fixed choice. Never add a feed name, link, article text, or search text.
:::

## Health counters

Three groups of counters measure how the app behaves in the field. They are informative during the beta and gate no release.

- **Startup.** `startup_ok` and `startup_failed` count once per run. One of four time buckets (`startup_time_lt_1s`, `startup_time_1_3s`, `startup_time_3_10s`, `startup_time_gt_10s`) counts the time from the creation of the process to the first river render. The renderer reports that render with `reportStartupComplete`. An error-level `system.failure`, `ipc.failure`, `renderer.failure`, or a failed `database.recovery` before that render counts `startup_failed`, and the matching error report carries the tag `startup: true`.
- **Adding a feed.** `feed_add_attempted` counts each `feeds:discover` request. `feed_add_succeeded` counts each stored feed. `feed_add_failed_discovery_none`, `feed_add_failed_network`, `feed_add_failed_parse`, and `feed_add_failed_unsupported` count why a discovery ended with nothing to add. `src/main/analytics/onboarding.ts` maps the error names.
- **Refresh errors.** Each failed refresh adds one `refresh_failures` and, when the cause is known, one of `refresh_error_timeout`, `refresh_error_http_4xx`, `refresh_error_http_5xx`, `refresh_error_tls`, `refresh_error_dns`, `refresh_error_parse`, or `refresh_error_too_large`. `src/main/analytics/error-buckets.ts` maps the errors. It reads the error text and keeps none of it.

Crash-free sessions come from the release health of Sentry, not from a counter.

The build reads `MONFIL_APTABASE_KEY` and `MONFIL_APTABASE_HOST` from the environment. The key prefix picks the server: `A-EU-` and `A-US-` use the hosted regions, and `A-SH-` uses the host for a self-hosted server. A development build, an end-to-end run, and a build with no key send nothing. An end-to-end spec can point the app at a local stub with `MONFIL_ANALYTICS_ENDPOINT` and shorten the send timer with `MONFIL_ANALYTICS_FLUSH_MS`. Both variables work only when `E2E_TEST` is `1`.

## Error reports

Bugs go to [Sentry](https://sentry.io), and outcomes that publishers and networks cause stay counters. The code lives in [`src/main/observability`](https://github.com/theopnv/monfil/tree/main/src/main/observability).

- `sentry.ts` loads `@sentry/electron` on the first start, and only when the user agreed and the build has a DSN. A user who declined or never decided does not load the SDK. It starts with an allowlist of default integrations, no traces, `release: monfil@<version>`, and `environment` of `github` or `store`. A second `init` throws, so a new agreement in the same run turns the client back on. Withdrawing turns it off and deletes `sentry/` in the user data folder and the pending crash dumps.
- `routing.ts` subscribes to `observeLogs`. It sends `system.failure`, `renderer.failure`, `ipc.failure`, `database.recovery`, `framework.fallback`, a failed `app.update`, and a `feed.refresh` failure that is not a network, HTTP, size, or parse outcome. Every other record becomes a breadcrumb that holds the event name and fixed choices only. The `incidentId` tag holds the first 8 characters of the incident ID that the error screen shows.
- `caps.ts` sends the same fingerprint once per run and 5 times per day, and about 30 events per day for the install, which protects the 5,000 events per month of the free plan.
- `scrub.ts` is the allowlist. It keeps known event fields, tags, and context fields, replaces links and email addresses, and turns the home folder into `~` and the user data folder into `<userData>`. It runs in `beforeSend` and in the last `beforeSendEvent` hook, so feedback events pass it too. Change it with its tests, then run `npm run mutate -- src/main/observability`.
- The renderer has no Sentry SDK. A renderer failure goes through `rendererLogger`, the `log:write` channel, and `routing.ts`. This keeps the content security policy of the renderer closed.
- `report.ts` serves the report form in the error screens. It sends an optional comment and an optional log file (the last megabyte, scrubbed) as Sentry feedback on the event of the incident. The native fatal dialog offers the log file only, because it has no text field.

The build reads `MONFIL_SENTRY_DSN`. Without it, in a development build, and in an end-to-end run, nothing is sent. An end-to-end spec can point the app at a local stub with `MONFIL_SENTRY_ENDPOINT`, a full DSN such as `http://key@127.0.0.1:1234/1`. It works only when `E2E_TEST` is `1`. `test/e2e/error-report.spec.ts` shows how.
