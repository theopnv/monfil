# Backend

`src/main` is the Electron main process. It owns the application lifecycle, the windows, the network, and the database. It is the only process with Node APIs. The renderer must never reach for them.
