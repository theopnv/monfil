// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useTranslation } from 'react-i18next';
import { Folder } from '@untitledui/icons';
import SettingsSection from '@/components/Settings/SettingsSection';
import { Button } from '@/components/untitled-ui/base/buttons/button';
import { Toggle } from '@/components/untitled-ui/base/toggle/toggle';
import { ipc } from '@/lib/ipc-client';
import { useServerSetting } from '@/lib/use-server-setting';

export default function DiagnosticsSection() {
  const { t } = useTranslation('settings');
  const [detailed, changeDetailed] = useServerSetting('detailedLogging', { optimistic: true });

  return (
    <SettingsSection id="diagnostics" title={t('section.diagnostics')}>
      <Toggle
        className="w-full"
        label={t('diagnostics.detailed')}
        hint={t('diagnostics.detailedHint')}
        isSelected={detailed ?? false}
        isDisabled={detailed === undefined}
        onChange={changeDetailed}
      />
      <Button color="secondary" iconLeading={Folder} className="self-start" onPress={() => ipc.send('app:reveal', 'log')}>
        {t('diagnostics.showLog')}
      </Button>
    </SettingsSection>
  );
}
