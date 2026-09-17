import { createFileRoute, useNavigate } from '@tanstack/react-router';
import Reader from '@/components/Reader/Reader';

export const Route = createFileRoute('/workspace/$workspaceId_/reader/$itemId')({
  component: ReaderRoute,
});

function ReaderRoute() {
  const { workspaceId, itemId } = Route.useParams();
  const navigate = useNavigate();

  return (
    <Reader
      itemId={itemId}
      onNavigateToItem={(id) => navigate({ to: '/workspace/$workspaceId/reader/$itemId', params: { workspaceId, itemId: String(id) } })}
      onNavigateHome={() => navigate({ to: '/workspace/$workspaceId', params: { workspaceId } })}
    />
  );
}
