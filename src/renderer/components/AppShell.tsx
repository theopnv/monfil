import type { CSSProperties } from 'react';
import LiveRegion from '@/components/common/LiveRegion';
import Toolbar from '@/components/Toolbar';
import { Outlet } from '@tanstack/react-router';

export default function AppShell() {
  return (
    <div className="App flex h-screen flex-col bg-primary text-primary">
      <LiveRegion />
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
