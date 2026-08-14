import { FeedsProvider } from "@/providers/feeds-provider";
import River from "./River";

export default function Home() {
  return (
    <div className="flex h-full w-full overflow-hidden">
      <FeedsProvider>
        <River />
      </FeedsProvider>

    </div>
  );
}
