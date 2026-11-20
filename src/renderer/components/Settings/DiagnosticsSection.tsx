// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { Folder } from '@untitledui/icons';
import SettingsSection from '@/components/Settings/SettingsSection';
import { Button } from '@/components/untitled-ui/base/buttons/button';
import { Toggle } from '@/components/untitled-ui/base/toggle/toggle';
import { ipc, rendererLogger } from '@/lib/ipc-client';

export default function DiagnosticsSection() {
  const { t } = useTranslation('settings');
  const [detailed, setDetailed] = useState<boolean>();

  useEffect(() => {
    void ipc.invoke('settings:get', { key: 'detailedLogging' })
      .then(setDetailed)
      .catch((error: unknown) => rendererLogger.error('renderer.failure', { message: 'Could not load diagnostic settings' }, error));
  }, []);

  const changeDetailed = (value: boolean) => {
    setDetailed(value);
    void ipc.invoke('settings:set', { key: 'detailedLogging', value: value })
      .then(setDetailed)
      .catch((error: unknown) => rendererLogger.error('renderer.failure', { message: 'Could not save diagnostic settings' }, error));
  };

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
