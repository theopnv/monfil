import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, RefreshCw01, SearchLg, XClose } from "@untitledui/icons";
import { Button } from "@/components/untitled-ui/base/buttons/button";
import { Input } from "@/components/untitled-ui/base/input/input";
import { announce } from "@/lib/announcer";
import { useClearPendingRefreshCount, usePendingRefreshCount } from "@/lib/ipc-bridge";
import { useFeedsRefresh } from "@/providers/feeds-provider";
import { usePreferences } from "@/providers/preferences-provider";
import { useActiveWorkspace } from "@/providers/workspace-provider";

const REFRESH_FAILED_MESSAGE = "Couldn't refresh feeds. Check your connection and try again.";

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
  hasFeeds: boolean;
}

export default function RiverHeader({ searchQuery, onSearchChange, hasFeeds }: RiverHeaderProps) {
  const { refreshNow, isRefreshing, refreshFailed } = useFeedsRefresh();
  const { preferences, setPreference } = usePreferences();
  const activeWorkspace = useActiveWorkspace();
  const pendingRefreshCount = usePendingRefreshCount();
  const clearPendingRefreshCount = useClearPendingRefreshCount();
  const queryClient = useQueryClient();

  const handlePendingClick = () => {
    clearPendingRefreshCount();
    void queryClient.invalidateQueries({ queryKey: ['river'] });
  };

  const wasRefreshing = useRef(false);
  useEffect(() => {
    if (wasRefreshing.current && !isRefreshing) {
      announce(refreshFailed ? REFRESH_FAILED_MESSAGE : "Feeds refreshed.");
    }
    wasRefreshing.current = isRefreshing;
  }, [isRefreshing, refreshFailed]);

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
    <header className="flex flex-none flex-col border-b border-secondary px-8.5 py-4.5">
      <div className="mx-auto flex w-full max-w-[860px] flex-col gap-2">
        <div className="flex items-end gap-5">
          <div className="min-w-0 flex-1">
            <div className="mb-1 text-xs font-semibold tracking-wide text-brand-secondary uppercase">{getGreeting()}</div>
            <h1 className="font-display text-display-md leading-none text-primary">{activeWorkspace?.name ?? "Home"}</h1>
          </div>

          {hasFeeds && (
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
              {pendingRefreshCount > 0 && (
                <Button color="primary" className="flex-none rounded-full" onPress={handlePendingClick}>
                  {pendingRefreshCount} new
                </Button>
              )}
              <Button
                color="secondary"
                iconLeading={Eye}
                className="flex-none rounded-full"
                onPress={() => setPreference("hideReadItems", !preferences.hideReadItems)}
              >
                {preferences.hideReadItems ? "Show All" : "Show Unread"}
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
          )}
        </div>

        {hasFeeds && refreshFailed && <p className="text-right text-sm text-error-primary">{REFRESH_FAILED_MESSAGE}</p>}
      </div>
    </header>
  );
}
