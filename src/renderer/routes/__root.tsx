// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { createRootRoute, useParams } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouteProvider } from '@/providers/route-provider';
import { ThemeProvider } from '@/providers/theme-provider';
import { PreferencesProvider } from '@/providers/preferences-provider';
import { SearchProvider } from '@/providers/search-provider';
import { HintsProvider } from '@/providers/hints-provider';
import { RiverScopeProvider } from '@/providers/river-scope-provider';
import { ActiveWorkspaceIdProvider } from '@/providers/workspace-provider';
import { useIpcBridge } from '@/lib/ipc-bridge';
import { parseRouteId } from '@/lib/route-params';
import { useUpdateNotification } from '@/lib/app-update';
import { useUsageReporting } from '@/providers/usage-reporting';
import AppShell from '@/components/AppShell';
import { ErrorRecovery } from '@/components/errors/ErrorRecovery';
import { StartupGate } from '@/components/errors/StartupGate';
import { NotificationHost } from '@/lib/notifications';

const queryClient = new QueryClient();

export const Route = createRootRoute({
  component: RootComponent,
  errorComponent: ({ error, reset }) => (
    <ErrorRecovery error={error} onRetry={async () => {
      await queryClient.resetQueries();
      reset();
    }} variant="route" />
  ),
});

function IpcBridgedAppShell() {
  useIpcBridge();
  useUpdateNotification();
  useUsageReporting();
  return <AppShell />;
}

function RootComponent() {
  const routeWorkspaceId = parseRouteId(useParams({ strict: false }).workspaceId);
  return (
    <RouteProvider>
      <ThemeProvider>
        <PreferencesProvider>
          <SearchProvider workspaceId={routeWorkspaceId}>
            <RiverScopeProvider>
              <ActiveWorkspaceIdProvider>
                <QueryClientProvider client={queryClient}>
                  <StartupGate>
                    <HintsProvider>
                      <IpcBridgedAppShell />
                    </HintsProvider>
                  </StartupGate>
                  <NotificationHost />
                </QueryClientProvider>
              </ActiveWorkspaceIdProvider>
            </RiverScopeProvider>
          </SearchProvider>
        </PreferencesProvider>
        <TanStackRouterDevtools position="bottom-right" />
      </ThemeProvider>
    </RouteProvider>
  );
}
