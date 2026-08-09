import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { RouteProvider } from '@/providers/route-provider';
import { ThemeProvider } from './providers/theme-provider';
import '@/styles/globals.css';
import App from './App';

import './index.css';

const container = document.getElementById('root') as HTMLElement;
const root = createRoot(container);
root.render(
  <StrictMode>
    <BrowserRouter>
      <RouteProvider>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </RouteProvider>
    </BrowserRouter>
  </StrictMode>
);
