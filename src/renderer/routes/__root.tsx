import { createRootRoute } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import { RouteProvider } from '@/providers/route-provider';
import { ThemeProvider } from '@/providers/theme-provider';
import { PreferencesProvider } from '@/providers/preferences-provider';
import { FeedsProvider } from '@/providers/feeds-provider';
import AppShell from '@/components/AppShell';

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <RouteProvider>
      <ThemeProvider>
        <PreferencesProvider>
          <FeedsProvider>
            <AppShell />
          </FeedsProvider>
        </PreferencesProvider>
        <TanStackRouterDevtools position="bottom-right" />
      </ThemeProvider>
    </RouteProvider>
  );
}
