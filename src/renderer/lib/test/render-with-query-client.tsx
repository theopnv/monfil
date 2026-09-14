import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderResult } from 'vitest-browser-react';
import type { ReactElement } from 'react';

/** A client scoped to one test: no retries, no cache carried over into the next one. */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

/**
 * Renders `ui` under a fresh `QueryClientProvider`. Returns the client alongside the render result,
 * so a test can seed or inspect the cache directly when mocking the IPC response isn't enough.
 */
export async function renderWithQueryClient(ui: ReactElement, queryClient: QueryClient = createTestQueryClient()): Promise<RenderResult & { queryClient: QueryClient }> {
  const result = await render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
  return { queryClient, ...result };
}
