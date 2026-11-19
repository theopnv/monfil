// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import UsageAnalyticsPreview from '@/components/Privacy/UsageAnalyticsPreview';
import SettingsSection from '@/components/Settings/SettingsSection';
import { Button } from '@/components/untitled-ui/base/buttons/button';
import { Toggle } from '@/components/untitled-ui/base/toggle/toggle';
import { openLink } from '@/lib/river/utils';
import { useUsageAnalytics } from '@/lib/usage';
import { USAGE_ANALYTICS_NOTICE_URL } from '../../../shared/contracts';

export default function PrivacySection() {
  const { t } = useTranslation('settings');
  const { state, choose } = useUsageAnalytics();
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  return (
    <SettingsSection id="privacy" title={t('section.privacy')}>
      <Toggle
        className="w-full"
        label={t('privacy.share')}
        hint={state?.available === false
          ? t('privacy.unavailable')
          : t('privacy.shareHint')}
        isSelected={state?.consent === 'granted'}
        isDisabled={state === undefined || !state.available}
        onChange={(selected) => choose(selected ? 'granted' : 'denied')}
      />
      <div className="flex gap-2.5">
        <Button color="secondary" className="self-start" onPress={() => setIsPreviewOpen(true)}>{t('privacy.preview')}</Button>
        <Button color="tertiary" className="self-start" onPress={() => openLink(USAGE_ANALYTICS_NOTICE_URL)}>{t('privacy.notice')}</Button>
      </div>
      <UsageAnalyticsPreview isOpen={isPreviewOpen} onOpenChange={setIsPreviewOpen} />
    </SettingsSection>
  );
}
