import { createFileRoute, useNavigate } from '@tanstack/react-router';
import Reader from '@/components/Reader/Reader';

export const Route = createFileRoute('/reader/$itemId')({
  component: ReaderRoute,
});

function ReaderRoute() {
  const { itemId } = Route.useParams();
  const navigate = useNavigate();

  return (
    <Reader
      itemId={itemId}
      onNavigateToItem={(id) => navigate({ to: '/reader/$itemId', params: { itemId: String(id) } })}
      onNavigateHome={() => navigate({ to: '/' })}
    />
  );
}
