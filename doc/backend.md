# Backend

`src/main` is the Electron main process. It owns:
- The application lifecycle
- The windows
- The network
- The database.

It is the only process with Node APIs. The renderer must never reach for them.
