import { useNavigate } from "@tanstack/react-router";
import River from "./River";
import { useActiveWorkspaceId } from "@/providers/workspace-provider";

export default function Home() {
  const navigate = useNavigate();
  const workspaceId = useActiveWorkspaceId();

  return (
    <div className="flex h-full w-full overflow-hidden">
      <River onOpenItem={(id) => navigate({ to: '/workspace/$workspaceId/reader/$itemId', params: { workspaceId: String(workspaceId), itemId: String(id) } })} />
    </div>
  );
}
