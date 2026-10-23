// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useState } from 'react';
import { XClose } from '@untitledui/icons';
import UsageAnalyticsPreview from '@/components/Privacy/UsageAnalyticsPreview';
import { Button } from '@/components/untitled-ui/base/buttons/button';
import { openLink } from '@/lib/river/utils';
import { useUsageAnalytics } from '@/lib/usage';
import { USAGE_ANALYTICS_NOTICE_URL } from '../../../shared/contracts';

export default function UsageAnalyticsCard() {
  const { state, choose, dismiss } = useUsageAnalytics();
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  if (!state?.shouldPrompt) {
    return null;
  }

  return (
    <section aria-label="Anonymous usage stats" className="absolute right-6 bottom-6 z-10 flex w-[360px] flex-col gap-3 rounded-xl border-2 border-brand-solid bg-primary p-4 shadow-2xl ring-8 ring-black/5">
      <button type="button" aria-label="Ask me later" className="absolute top-3 right-3 text-tertiary hover:text-secondary" onClick={() => dismiss()}>
        <XClose className="size-4" />
      </button>
      <h2 className="pr-6 text-md font-semibold text-primary">Help improve Monfil</h2>
      <p className="text-sm text-tertiary">
        Share anonymous usage stats: one daily count of the features you use. No feed, article, or search text leaves your device. You can change this in Settings at any time.
      </p>
      <div className="flex gap-2 text-sm">
        <button type="button" className="text-brand-secondary underline" onClick={() => setIsPreviewOpen(true)}>See what is sent</button>
        <span aria-hidden="true" className="text-tertiary">·</span>
        <button type="button" className="text-brand-secondary underline" onClick={() => openLink(USAGE_ANALYTICS_NOTICE_URL)}>Privacy notice</button>
      </div>
      <div className="flex gap-2.5">
        <Button color="secondary" size="md" className="flex-1 rounded-full" onPress={() => choose('granted')}>Share usage stats</Button>
        <Button color="secondary" size="md" className="flex-1 rounded-full" onPress={() => choose('denied')}>No thanks</Button>
      </div>
      <UsageAnalyticsPreview isOpen={isPreviewOpen} onOpenChange={setIsPreviewOpen} />
    </section>
  );
}
