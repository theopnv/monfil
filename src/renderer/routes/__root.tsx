import { createRootRoute } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouteProvider } from '@/providers/route-provider';
import { ThemeProvider } from '@/providers/theme-provider';
import { PreferencesProvider } from '@/providers/preferences-provider';
import { SearchProvider } from '@/providers/search-provider';
import { RiverScopeProvider } from '@/providers/river-scope-provider';
import { useIpcBridge } from '@/lib/ipc-bridge';
import AppShell from '@/components/AppShell';

const queryClient = new QueryClient();

export const Route = createRootRoute({
  component: RootComponent,
});

function IpcBridgedAppShell() {
  useIpcBridge();
  return <AppShell />;
}

function RootComponent() {
  return (
    <RouteProvider>
      <ThemeProvider>
        <PreferencesProvider>
          <SearchProvider>
            <RiverScopeProvider>
              <QueryClientProvider client={queryClient}>
                <IpcBridgedAppShell />
              </QueryClientProvider>
            </RiverScopeProvider>
          </SearchProvider>
        </PreferencesProvider>
        <TanStackRouterDevtools position="bottom-right" />
      </ThemeProvider>
    </RouteProvider>
  );
}
