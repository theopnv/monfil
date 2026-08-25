# Storage

"Where" to store data is depending on whether the main process of the electron app needs it or not.

## Database

For anything main must read.
- Refresh interval and refresh on launch live here because the scheduler runs in the main process and needs them directly, not through a renderer round-trip.

Check [Database](./database.md) for more information on the implementation.

## Local storage

For renderer only data that main never reads. Using it skips an extra IPC channel for data that main doesn't need.
- Reader preferences (density, hide-read-items, open-links-externally)
- Theme
