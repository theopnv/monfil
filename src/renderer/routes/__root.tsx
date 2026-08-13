import { createRootRoute } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import { RouteProvider } from '@/providers/route-provider';
import { ThemeProvider } from '@/providers/theme-provider';
import AppShell from '@/components/AppShell';

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <RouteProvider>
      <ThemeProvider>
        <AppShell />
        <TanStackRouterDevtools position="bottom-right" />
      </ThemeProvider>
    </RouteProvider>
  );
}
