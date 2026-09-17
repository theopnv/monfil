import Home from '@/components/Home/Home';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/workspace/$workspaceId')({
  component: Home,
});
