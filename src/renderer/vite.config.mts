import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';

// Delivered as a <meta> tag: the packaged app loads index.html from file://, where there are no response headers.
// Styles allow 'unsafe-inline' because Tailwind and React Aria set inline style attributes; fonts come from
// Google Fonts (see src/renderer/styles/globals.css); images come from any feed or article host.
const CONTENT_SECURITY_POLICY = {
  'default-src': ["'self'"],
  'script-src': ["'self'"],
  'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
  'font-src': ["'self'", 'https://fonts.gstatic.com'],
  'img-src': ["'self'", 'http:', 'https:', 'data:'],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
};

// The dev server injects the React refresh preamble as an inline script and talks HMR over a websocket.
const DEV_CONTENT_SECURITY_POLICY = {
  ...CONTENT_SECURITY_POLICY,
  'script-src': [...CONTENT_SECURITY_POLICY['script-src'], "'unsafe-inline'"],
  'connect-src': ["'self'", 'ws:'],
};

function serializePolicy(policy: Record<string, string[]>): string {
  return Object.entries(policy).map(([directive, sources]) => `${directive} ${sources.join(' ')}`).join('; ');
}

function contentSecurityPolicy(): Plugin {
  return {
    name: 'monfil:content-security-policy',
    transformIndexHtml(_html, { server }) {
      return [{
        tag: 'meta',
        attrs: {
          'http-equiv': 'Content-Security-Policy',
          content: serializePolicy(server ? DEV_CONTENT_SECURITY_POLICY : CONTENT_SECURITY_POLICY),
        },
        injectTo: 'head-prepend',
      }];
    },
  };
}

// https://vitejs.dev/config
export default defineConfig({
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
      routesDirectory: './src/renderer/routes',
      generatedRouteTree: './src/renderer/routeTree.gen.ts',
    }),
    react(),
    tailwindcss(),
    contentSecurityPolicy(),
  ],
  resolve: {
    alias: {
      '@': import.meta.dirname,
    },
  },
});
