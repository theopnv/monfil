---
title: Diagnostics
description: Find a failed operation and test its recovery path.
sidebar:
  order: 10
---

Main-process logs live in `src/main/logging/`. The renderer reports errors through the `log:write` IPC channel. Settings can reveal the log file and enable detailed logging. Keep sensitive feed URLs and content behind the existing redaction path in `logger.ts`.

Expected failures return a tagged `Result` to the caller. Unexpected IPC failures receive an incident ID in `src/main/ipc/registerIpcHandlers.ts`; the renderer can show that ID with a retry and a link to the log. Startup has a separate health result. `src/renderer/components/errors/StartupGate.tsx` and `ErrorRecovery.tsx` show the paths for a database reset or failed startup.

When you investigate a report, reproduce the action, note its incident ID, and inspect the log entry with that ID. Test the operation at its owning boundary. Use an Electron end-to-end test when the behavior depends on the packaged window, preload bridge, or filesystem layout. `AGENTS.md` lists the focused test commands.
