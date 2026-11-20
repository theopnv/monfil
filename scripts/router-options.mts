import type { Config } from '@tanstack/router-generator';

// Shared by the renderer Vite config and scripts/generate-route-tree.mts, so both write the same routeTree.gen.ts.
export const ROUTER_OPTIONS = {
  target: 'react',
  autoCodeSplitting: true,
  routesDirectory: './src/renderer/routes',
  generatedRouteTree: './src/renderer/routeTree.gen.ts',
} satisfies Partial<Config>;
