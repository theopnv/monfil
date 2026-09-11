import { FilterLines, RefreshCw01, SearchLg, XClose } from "@untitledui/icons";
import { Button } from "@/components/untitled-ui/base/buttons/button";
import { Input } from "@/components/untitled-ui/base/input/input";
import { useFeedsRefresh } from "@/providers/feeds-provider";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) {
    return "Good morning";
  }
  if (hour < 18) {
    return "Good afternoon";
  }
  return "Good evening";
}

// Input's `icon` prop is typed as ComponentType<HTMLAttributes<HTMLOrSVGElement>>,
// but @untitledui/icons components are typed against SVGProps. InputBase only
// ever passes `className`, so this wrapper narrows to what's actually used.
function SearchIcon({ className }: { className?: string | undefined }) {
  return <SearchLg className={className} />;
}

export interface RiverHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export default function RiverHeader({ searchQuery, onSearchChange }: RiverHeaderProps) {
  const { refreshNow, isRefreshing } = useFeedsRefresh();

  // The webkit cancel button is hidden in globals.css, so the field renders its
  // own clear cross while the query is set; Escape clears as well.
  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      onSearchChange("");
    }
  };

  // Keeps focus in the field after clearing, instead of dropping it on the cross.
  const handleCrossMouseDown = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
  };

  return (
    <header className="flex flex-none items-end gap-5 border-b border-secondary px-8.5 py-4.5">
      <div className="min-w-0 flex-1">
        <div className="mb-1 text-xs font-semibold tracking-wide text-brand-secondary uppercase">{getGreeting()}</div>
        <h1 className="font-display text-display-md leading-none text-primary">Home</h1>
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-end gap-2.5">
        <div className="relative min-w-30 max-w-75 flex-1">
          <Input
            placeholder="Search everything"
            icon={SearchIcon}
            wrapperClassName="rounded-full"
            inputClassName="pr-9"
            value={searchQuery}
            onChange={onSearchChange}
            onKeyDown={handleSearchKeyDown}
          />
          {searchQuery.length > 0 && (
            <button
              type="button"
              aria-label="Clear search"
              onMouseDown={handleCrossMouseDown}
              onClick={() => onSearchChange("")}
              className="absolute right-2.5 top-1/2 flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-fg-quaternary transition duration-100 ease-linear hover:text-fg-quaternary_hover focus:outline-hidden"
            >
              <XClose className="size-4 stroke-[2.25px]" />
            </button>
          )}
        </div>
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
