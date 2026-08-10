import { Outlet } from '@tanstack/react-router';
import { FeedsProvider } from '@/providers/feeds-provider';
import Toolbar from '@/components/Toolbar';

export default function AppShell() {
  return (
    <div className="App flex h-screen flex-col bg-primary text-primary">
      <div className="flex h-8 flex-none bg-secondary border-b border-secondary" />
      <div className="flex flex-1 overflow-hidden">
        <Toolbar />
        <FeedsProvider>
          <main className="flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </FeedsProvider>
      </div>
    </div>
  );
}
