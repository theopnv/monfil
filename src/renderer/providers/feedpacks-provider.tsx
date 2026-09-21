import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CatalogError, FeedpackCatalog } from '../../shared/contracts';
import type { FeedpackError, FeedpackInstallTarget, FeedpackPreview, InstallFeedpackError } from '../../shared/contracts';
import type { ImportSummary } from '../../shared/contracts';
import type { Result } from '../../shared/result';
import { queryKeys } from '@/lib/queries';
import { uiKeys } from '@/lib/ipc-bridge';

export const useFeedpackCatalog = (enabled: boolean) => useQuery({
  queryKey: ['feedpacks', 'catalog'],
  queryFn: () => window.electron.ipcRenderer.invoke('feedpacks:list', undefined),
  enabled,
  staleTime: Infinity,
});

export const useFeedpackPreview = (): ((slug: string) => Promise<Result<FeedpackPreview, FeedpackError>>) => {
  const mutation = useMutation({ mutationFn: (slug: string) => window.electron.ipcRenderer.invoke('feedpacks:preview', { slug }) });
  const { mutateAsync } = mutation;
  return useCallback((slug: string) => mutateAsync(slug), [mutateAsync]);
};

export const useInstallFeedpack = (): ((slug: string, target: FeedpackInstallTarget) => Promise<Result<ImportSummary, InstallFeedpackError>>) => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ slug, target }: { slug: string; target: FeedpackInstallTarget }) => window.electron.ipcRenderer.invoke('feedpacks:install', { slug, target }),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.setQueryData(uiKeys.feedpackRefreshing(result.data.workspaceId), true);
        void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces });
        void queryClient.invalidateQueries({ queryKey: ['feeds'] });
        void queryClient.invalidateQueries({ queryKey: ['categories'] });
        void queryClient.invalidateQueries({ queryKey: ['river'] });
      }
    },
  });
  const { mutateAsync } = mutation;
  return useCallback((slug: string, target: FeedpackInstallTarget) => mutateAsync({ slug, target }), [mutateAsync]);
};

export type FeedpackCatalogResult = Result<FeedpackCatalog, CatalogError>;
