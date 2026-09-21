import { useEffect, useState } from 'react';
import { Button } from '@/components/untitled-ui/base/buttons/button';
import { useFeedpackCatalog, useFeedpackPreview } from '@/providers/feedpacks-provider';
import type { Feedpack } from '../../../shared/contracts';
import type { FeedpackPreview } from '../../../shared/contracts';

export interface FeedpackBrowserProps {
  isActive: boolean;
  onSelectionChange: (selection: FeedpackPreview | null) => void;
}

export default function FeedpackBrowser({ isActive, onSelectionChange }: FeedpackBrowserProps) {
  const catalog = useFeedpackCatalog(isActive);
  const preview = useFeedpackPreview();
  const [selected, setSelected] = useState<FeedpackPreview | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isActive) {
      setSelected(null);
      setError(null);
      onSelectionChange(null);
    }
  }, [isActive, onSelectionChange]);

  async function showPack(pack: Feedpack) {
    setIsLoadingPreview(true);
    setError(null);
    const result = await preview(pack.slug);
    setIsLoadingPreview(false);
    if (result.success) {
      setSelected(result.data);
      onSelectionChange(result.data);
    } else {
      setError(result.error.message);
    }
  }

  function showCatalog() {
    setSelected(null);
    setError(null);
    onSelectionChange(null);
  }

  const catalogError = catalog.data && !catalog.data.success ? catalog.data.error.message : null;

  if (selected) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4.5">
        <div className="flex flex-col gap-1.5 pb-4">
          <h3 className="font-medium text-primary">{selected.pack.title}</h3>
          <p className="text-sm text-tertiary">{selected.pack.description}</p>
          <p className="text-sm text-secondary">{selected.sources.categories.reduce((total, category) => total + category.feeds.length, 0)} sources</p>
        </div>

        <ul aria-label="Pack sources" className="flex flex-col gap-3 border-l border-secondary pl-4">
          {selected.sources.categories.map((category) => (
            <li key={category.name}>
              <p className="text-sm font-semibold text-primary">{category.name}</p>
              <ul className="mt-1 flex flex-col gap-1 border-l border-secondary pl-3 text-sm text-tertiary">
                {category.feeds.map((feed) => <li key={feed.xmlUrl}>{feed.title}</li>)}
              </ul>
            </li>
          ))}
        </ul>

        <Button color="secondary" size="md" className="mt-5" onPress={showCatalog}>Back to feedpacks</Button>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4.5">
      <div className="flex flex-col gap-2">
        {catalog.isPending && <p className="text-sm text-tertiary">Loading feedpacks…</p>}
        {(catalogError ?? error) && <p className="text-sm text-error-primary">{catalogError ?? error}</p>}
        {catalog.data?.success && catalog.data.data.packs.length === 0 && <p className="text-sm text-tertiary">No feedpacks are available.</p>}
        {catalog.data?.success && catalog.data.data.packs.map((pack) => (
          <Button key={pack.slug} color="secondary" size="md" className="h-auto justify-start py-3 text-left" onPress={() => void showPack(pack)}>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="min-w-0 truncate font-medium">{pack.title}</span>
                <span className="flex-none text-tertiary">{pack.sourceCount} sources</span>
              </span>
              <span className="whitespace-normal break-words text-tertiary">{pack.description}</span>
            </span>
          </Button>
        ))}
        {isLoadingPreview && <p className="text-sm text-tertiary">Loading sources…</p>}
      </div>
    </div>
  );
}
