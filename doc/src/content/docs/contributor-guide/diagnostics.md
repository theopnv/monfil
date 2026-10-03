---
title: Diagnostics
description: Find a failed operation and test its recovery path.
sidebar:
  order: 10
---

Main-process logs live in the [logging folder](https://github.com/theopnv/monfil/tree/main/src/main/logging). The renderer reports errors through `log:write`. In Settings, a user can reveal the log file or enable detailed logging.

:::caution[Protect feed data]
Keep feed URLs and content behind the existing [log redaction](https://github.com/theopnv/monfil/blob/main/src/main/logging/logger.ts) when you add diagnostics.
:::

## Follow a failure

Expected failures return a tagged `Result` to the caller. An unexpected IPC failure gets an incident ID, which the renderer can show beside a retry action and a link to the log. Startup has a separate health result; the [error components](https://github.com/theopnv/monfil/tree/main/src/renderer/components/errors) handle a database reset or failed startup.

To investigate a report, reproduce the action and note its incident ID. Find that ID in the log, then test the operation at the boundary that owns it. Use an Electron end-to-end test when the result depends on the packaged window, preload bridge, or filesystem layout. The repository's [contribution instructions](https://github.com/theopnv/monfil/blob/main/AGENTS.md) list focused test commands.
