import { useNavigate } from "@tanstack/react-router";
import River from "./River";

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="flex h-full w-full overflow-hidden">
      <River onOpenItem={(id) => navigate({ to: '/reader/$itemId', params: { itemId: String(id) } })} />
    </div>
  );
}
