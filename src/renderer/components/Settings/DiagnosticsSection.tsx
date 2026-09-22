import { useEffect, useState } from 'react';
import { Folder } from '@untitledui/icons';
import SettingsSection from '@/components/Settings/SettingsSection';
import { Button } from '@/components/untitled-ui/base/buttons/button';
import { Toggle } from '@/components/untitled-ui/base/toggle/toggle';
import { ipc, rendererLogger } from '@/lib/ipc-client';

export default function DiagnosticsSection() {
  const [detailed, setDetailed] = useState<boolean>();

  useEffect(() => {
    void ipc.invoke('settings:get-detailed-logging', undefined)
      .then(setDetailed)
      .catch((error: unknown) => rendererLogger.error('renderer.failure', { message: 'Could not load diagnostic settings' }, error));
  }, []);

  const changeDetailed = (value: boolean) => {
    setDetailed(value);
    void ipc.invoke('settings:set-detailed-logging', value)
      .then(setDetailed)
      .catch((error: unknown) => rendererLogger.error('renderer.failure', { message: 'Could not save diagnostic settings' }, error));
  };

  return (
    <SettingsSection id="diagnostics" title="Diagnostics">
      <Toggle
        className="w-full"
        label="Detailed logging"
        hint="Record debug details in the local log file. Feed names, full links, article text, credentials, and file paths are removed."
        isSelected={detailed ?? false}
        isDisabled={detailed === undefined}
        onChange={changeDetailed}
      />
      <Button color="secondary" iconLeading={Folder} className="self-start" onPress={() => ipc.send('app:reveal-log-file', undefined)}>
        Show log file
      </Button>
    </SettingsSection>
  );
}
