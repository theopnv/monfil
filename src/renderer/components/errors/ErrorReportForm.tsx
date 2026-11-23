// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { Button } from '@/components/untitled-ui/base/buttons/button';
import { ipc } from '@/lib/ipc-client';
import { ERROR_REPORT_COMMENT_MAX_LENGTH, type ErrorReportLogPreview } from '../../../shared/contracts';

interface ErrorReportFormProps {
  /** The short incident ID that the error screen shows. */
  incidentId?: string | undefined;
}

type Status = 'idle' | 'sending' | 'sent' | 'failed';

interface LogPreviewProps {
  isOpen: boolean;
  onToggle: () => void;
  log: ErrorReportLogPreview | undefined;
}

function LogPreview({ isOpen, onToggle, log }: LogPreviewProps) {
  const { t } = useTranslation('errors');
  return (
    <div className="flex flex-col items-start gap-2">
      <Button color="link-color" size="sm" onPress={onToggle}>
        {isOpen ? t('report.hidePreview') : t('report.showPreview')}
      </Button>
      {isOpen && (
        <>
          <pre aria-label={t('report.previewLabel')} className="max-h-48 w-full overflow-auto rounded-lg bg-secondary p-3 text-xs text-secondary">
            {log ? (log.text || t('report.previewEmpty')) : t('report.loading')}
          </pre>
          {log?.truncated && <p className="text-xs text-tertiary">{t('report.previewTruncated')}</p>}
        </>
      )}
    </div>
  );
}

/**
 * Lets the user add a comment and the log file to the error report that Monfil already sent. It appears only while
 * error reports are on, and it talks to the main process directly, so it works when the database or the query cache is gone.
 */
export function ErrorReportForm({ incidentId }: ErrorReportFormProps) {
  const { t } = useTranslation('errors');
  const [enabled, setEnabled] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [comment, setComment] = useState('');
  const [attachLog, setAttachLog] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [log, setLog] = useState<ErrorReportLogPreview>();
  const [status, setStatus] = useState<Status>('idle');

  useEffect(() => {
    let current = true;
    ipc.invoke('report:get-state')
      .then((state) => current && setEnabled(state.enabled))
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, []);

  useEffect(() => {
    if (!isPreviewOpen || log) {
      return;
    }
    ipc.invoke('report:preview-log').then(setLog).catch(() => setLog({ text: '', truncated: false }));
  }, [isPreviewOpen, log]);

  async function send() {
    setStatus('sending');
    try {
      const result = await ipc.invoke('report:submit', { incidentId, comment, attachLog });
      setStatus(result.success ? 'sent' : 'failed');
    } catch {
      setStatus('failed');
    }
  }

  if (!enabled) {
    return null;
  }
  if (status === 'sent') {
    return <p role="status" className="text-sm text-tertiary">{t('report.sent')}</p>;
  }
  if (!isOpen) {
    return <Button color="tertiary" size="sm" onPress={() => setIsOpen(true)}>{t('report.add')}</Button>;
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <p className="text-sm text-tertiary">{t('report.consentNote')}</p>
      <label htmlFor="error-report-comment" className="text-sm font-medium text-secondary">{t('report.comment')}</label>
      <textarea
        id="error-report-comment"
        rows={3}
        maxLength={ERROR_REPORT_COMMENT_MAX_LENGTH}
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        className="w-full resize-y rounded-lg border border-primary bg-primary px-3 py-2 text-sm text-primary shadow-xs"
      />
      <label htmlFor="error-report-attach-log" className="flex items-center gap-2 text-sm font-medium text-secondary">
        <input id="error-report-attach-log" type="checkbox" checked={attachLog} onChange={(event) => setAttachLog(event.target.checked)} />
        {t('report.attachLog')}
      </label>
      <LogPreview isOpen={isPreviewOpen} onToggle={() => setIsPreviewOpen((open) => !open)} log={log} />
      {status === 'failed' && <p role="alert" className="text-sm text-error-primary">{t('report.failed')}</p>}
      <div className="flex gap-2">
        <Button color="primary" size="sm" isDisabled={status === 'sending'} onPress={() => void send()}>
          {status === 'sending' ? t('report.sending') : t('report.send')}
        </Button>
        <Button color="secondary" size="sm" onPress={() => setIsOpen(false)}>{t('report.cancel')}</Button>
      </div>
    </div>
  );
}
