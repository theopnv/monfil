// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Heading } from 'react-aria-components';
import { ErrorText } from '@/components/errors/ErrorText';
import { Dialog, Modal, ModalOverlay } from '@/components/untitled-ui/application/modals/modal';
import { Button } from '@/components/untitled-ui/base/buttons/button';
import { cx } from '@/components/untitled-ui/utils/cx';
import type { CodedError } from '../../../shared/errors';
import type { Result } from '../../../shared/result';
import { dialogFooterClass, dialogHeaderClass, dialogTitleClass } from './dialog-classes';

/** The loading state and the error of a destructive action, and the close handler that forgets the error. */
export function useConfirmAction<E extends CodedError>(onOpenChange: (open: boolean) => void) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<E | null>(null);

  function handleOpenChange(open: boolean) {
    if (!open) {
      setError(null);
    }
    onOpenChange(open);
  }

  /** Runs `action`, and calls `onSuccess` when it succeeds, or shows its error when it does not. */
  async function run(action: () => Promise<Result<unknown, E>>, onSuccess: () => void) {
    setIsLoading(true);
    setError(null);
    const response = await action();
    setIsLoading(false);
    if (response.success) {
      onSuccess();
    } else {
      setError(response.error);
    }
  }

  return { isLoading, error, setError, handleOpenChange, run };
}

interface ConfirmDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** The width class of the modal. */
  widthClass: string;
  title: ReactNode;
  description?: ReactNode;
  /** Content between the header and the error. */
  children?: ReactNode;
  error: CodedError | null;
  confirmLabel: ReactNode;
  isLoading: boolean;
  onConfirm: () => void;
  /** Content at the start of the footer, which moves the buttons to the end. */
  footerStart?: ReactNode;
}

export function ConfirmDialog({ isOpen, onOpenChange, widthClass, title, description, children, error, confirmLabel, isLoading, onConfirm, footerStart }: ConfirmDialogProps) {
  const { t } = useTranslation('common');
  const buttons = (
    <>
      <Button color="secondary" size="md" className="rounded-full" onPress={() => onOpenChange(false)}>
        {t('action.cancel')}
      </Button>
      <Button color="primary-destructive" size="md" className="rounded-full" isLoading={isLoading} onPress={onConfirm}>
        {confirmLabel}
      </Button>
    </>
  );
  return (
    <ModalOverlay isOpen={isOpen} onOpenChange={onOpenChange} isDismissable>
      <Modal className={cx('w-full', widthClass)}>
        <Dialog>
          <div className={dialogHeaderClass}>
            <Heading slot="title" className={dialogTitleClass}>{title}</Heading>
            {description && <p className="text-sm text-tertiary">{description}</p>}
          </div>

          {children}

          {error && <ErrorText error={error} className="px-6 pb-2 text-sm text-error-primary" />}

          <div className={cx(dialogFooterClass, footerStart && 'justify-between')}>
            {footerStart}
            {footerStart ? <div className="flex items-center gap-2.5">{buttons}</div> : buttons}
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
