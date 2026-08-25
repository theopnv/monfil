import type { CSSProperties } from 'react';
import Toolbar from '@/components/Home/Toolbar';
import { Outlet } from '@tanstack/react-router';

export default function AppShell() {
  return (
    <div className="App flex h-screen flex-col bg-primary text-primary">
      <div
        className="flex h-8 flex-none bg-secondary border-b border-secondary"
        style={{ WebkitAppRegion: 'drag' } as CSSProperties}
      />
      <div className="flex flex-1 overflow-hidden">
        <Toolbar />
        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
