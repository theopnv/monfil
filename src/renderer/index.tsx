import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider, createHashHistory, createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen.ts';
import '@/styles/globals.css';

// The renderer is loaded via the `file://` protocol in production, so browser
// history (path-based routing) can't resolve routes against the filesystem path.
const router = createRouter({
  routeTree,
  history: createHashHistory(),
  scrollRestoration: true,
  // Key by href, not the default history-entry key: "Back to Home" pushes a fresh entry
  // rather than going back, so a key tied to that entry would never match the river's
  // previous visit and the scroll position would never be found.
  getScrollRestorationKey: (location) => location.href,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

const container = document.getElementById('root') as HTMLElement;
const root = createRoot(container);
root.render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
