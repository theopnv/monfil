import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider, createHashHistory, createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen.ts';
import '@/styles/globals.css';

// The renderer is loaded via the `file://` protocol in production, so browser
// history (path-based routing) can't resolve routes against the filesystem path.
const router = createRouter({ routeTree, history: createHashHistory() });

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
