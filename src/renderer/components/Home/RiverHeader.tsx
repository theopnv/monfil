import { FilterLines, RefreshCw01, SearchLg } from "@untitledui/icons";
import { Button } from "@/components/untitled-ui/base/buttons/button";
import { Input } from "@/components/untitled-ui/base/input/input";
import { useFeedsRefresh } from "@/providers/feeds-provider";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

// Input's `icon` prop is typed as ComponentType<HTMLAttributes<HTMLOrSVGElement>>,
// but @untitledui/icons components are typed against SVGProps. InputBase only
// ever passes `className`, so this wrapper narrows to what's actually used.
function SearchIcon({ className }: { className?: string | undefined }) {
  return <SearchLg className={className} />;
}

export default function RiverHeader() {
  const { refreshNow, isRefreshing } = useFeedsRefresh();

  return (
    <header className="flex flex-none items-end gap-5 border-b border-secondary px-8.5 py-4.5">
      <div className="min-w-0 flex-1">
        <div className="mb-1 text-xs font-semibold tracking-wide text-brand-secondary uppercase">{getGreeting()}</div>
        <h1 className="font-display text-display-md leading-none text-primary">Home</h1>
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-end gap-2.5">
        <Input placeholder="Search everything" icon={SearchIcon} className="min-w-30 max-w-75 flex-1" wrapperClassName="rounded-full" />
        <Button color="secondary" iconLeading={FilterLines} className="flex-none rounded-full">
          Filter
        </Button>
        <Button
          aria-label="Refresh feeds"
          color="secondary"
          iconLeading={RefreshCw01}
          className="flex-none rounded-full"
          isLoading={isRefreshing}
          isDisabled={isRefreshing}
          onPress={refreshNow}
        />
      </div>
    </header>
  );
}
