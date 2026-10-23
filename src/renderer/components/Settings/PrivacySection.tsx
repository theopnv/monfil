// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useState } from 'react';
import UsageAnalyticsPreview from '@/components/Privacy/UsageAnalyticsPreview';
import SettingsSection from '@/components/Settings/SettingsSection';
import { Button } from '@/components/untitled-ui/base/buttons/button';
import { Toggle } from '@/components/untitled-ui/base/toggle/toggle';
import { openLink } from '@/lib/river/utils';
import { useUsageAnalytics } from '@/lib/usage';
import { USAGE_ANALYTICS_NOTICE_URL } from '../../../shared/contracts';

export default function PrivacySection() {
  const { state, choose } = useUsageAnalytics();
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  return (
    <SettingsSection id="privacy" title="Privacy">
      <Toggle
        className="w-full"
        label="Share anonymous usage stats"
        hint={state?.available === false
          ? 'This build of Monfil does not collect usage stats.'
          : 'Send one daily count of the features you use. No feed, article, or search text leaves your device. Turn it off at any time to stop sending and delete the counts kept on this device.'}
        isSelected={state?.consent === 'granted'}
        isDisabled={state === undefined || !state.available}
        onChange={(selected) => choose(selected ? 'granted' : 'denied')}
      />
      <div className="flex gap-2.5">
        <Button color="secondary" className="self-start" onPress={() => setIsPreviewOpen(true)}>See what is sent</Button>
        <Button color="tertiary" className="self-start" onPress={() => openLink(USAGE_ANALYTICS_NOTICE_URL)}>Privacy notice</Button>
      </div>
      <UsageAnalyticsPreview isOpen={isPreviewOpen} onOpenChange={setIsPreviewOpen} />
    </SettingsSection>
  );
}
