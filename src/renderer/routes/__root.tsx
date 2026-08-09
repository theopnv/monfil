import type { CSSProperties } from 'react';
import { Outlet, createRootRoute } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import { RouteProvider } from '@/providers/route-provider';
import { ThemeProvider } from '@/providers/theme-provider';
import { FeedsProvider } from '@/providers/feeds-provider';
import { MAIN_SIDEBAR_WIDTH, SidebarSectionDualTier } from '@/components/Navigation';

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <RouteProvider>
      <ThemeProvider>
        <FeedsProvider>
          <div className="App min-h-screen bg-primary text-primary">
            <div
              className="container mx-auto p-4 lg:pl-(--sidebar-width)"
              style={{ '--sidebar-width': `${MAIN_SIDEBAR_WIDTH}px` } as CSSProperties}
            >
              <SidebarSectionDualTier />
              <Outlet />
            </div>
          </div>
          <TanStackRouterDevtools position="bottom-right" />
        </FeedsProvider>
      </ThemeProvider>
    </RouteProvider>
  );
}
