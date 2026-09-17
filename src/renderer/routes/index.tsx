import { createFileRoute, redirect } from '@tanstack/react-router';
import { HOME_WORKSPACE_ID } from '../../preload/channels';

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({ to: '/workspace/$workspaceId', params: { workspaceId: String(HOME_WORKSPACE_ID) } });
  },
});
