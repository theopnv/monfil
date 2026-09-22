import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, type PropsWithChildren } from 'react';
import { ipc } from '@/lib/ipc-client';
import { ErrorRecovery } from './ErrorRecovery';
import { notifyWarning } from '@/lib/notifications';

export function StartupGate({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const health = useQuery({ queryKey: ['startup-health'], queryFn: () => ipc.invoke('app:get-startup-health', undefined), retry: false });
  useEffect(() => {
    if (health.data?.name === 'RESET') {
      notifyWarning('Monfil recovered from a damaged database. A backup was kept.', 'database-recovered', {
        label: 'Reveal backup',
        onClick: () => ipc.send('app:reveal-database-backup', undefined),
      });
    }
  }, [health.data]);
  if (health.isPending) {
    return <div className="flex h-screen items-center justify-center bg-primary text-primary">Starting Monfil…</div>;
  }
  if (health.isError || health.data?.name === 'FAILED') {
    const error = health.isError ? health.error : health.data;
    return (
      <ErrorRecovery error={error} variant="root" onRetry={async () => {
        await queryClient.resetQueries();
        await health.refetch();
      }} />
    );
  }
  return children;
}
