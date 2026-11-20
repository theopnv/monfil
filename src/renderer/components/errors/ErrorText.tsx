// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useTranslation } from 'react-i18next';
import { errorDetails, translateError } from '@/lib/error-text';
import type { CodedError } from '../../../shared/errors';

export function ErrorText({ error, className }: { error: CodedError; className?: string }) {
  const { t } = useTranslation('errors');
  const details = errorDetails(error);
  return (
    <div className={className}>
      <p>{translateError(t, error)}</p>
      {details && <p className="text-xs text-tertiary">{t('details', { message: details })}</p>}
    </div>
  );
}
