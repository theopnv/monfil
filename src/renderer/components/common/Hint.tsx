// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useEffect, type ReactNode, type RefObject } from 'react';
import { Button as AriaButton, OverlayArrow as AriaOverlayArrow, Popover as AriaPopover, type PopoverProps } from 'react-aria-components';
import { cx } from '@/components/untitled-ui/utils/cx';

export interface HintProps extends Pick<PopoverProps, 'placement'> {
  /** The element the hint points at. */
  triggerRef: RefObject<Element | null>;
  isOpen: boolean;
  onDismiss: () => void;
  children: ReactNode;
}

/** A first-run pointer: a short text beside one control, closed with "Got it" or Escape. */
export default function Hint({ triggerRef, isOpen, onDismiss, placement = 'bottom', children }: HintProps) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onDismiss();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onDismiss]);

  return (
    <AriaPopover
      triggerRef={triggerRef}
      isOpen={isOpen}
      isNonModal
      placement={placement}
      offset={10}
      onOpenChange={(open) => {
        if (!open) {
          onDismiss();
        }
      }}
      className={({ isEntering, isExiting }) => cx('z-50 outline-hidden', isEntering && 'ease-out animate-in', isExiting && 'ease-in animate-out')}
    >
      <AriaOverlayArrow>
        <svg
          viewBox="0 0 100 100"
          className="size-2.5 fill-bg-primary-solid in-placement-left:-rotate-90 in-placement-right:rotate-90 in-placement-top:rotate-0 in-placement-bottom:rotate-180"
        >
          <path d="M0,0 L35.858,35.858 Q50,50 64.142,35.858 L100,0 Z" />
        </svg>
      </AriaOverlayArrow>
      <div className="flex max-w-60 flex-col items-start gap-2 rounded-lg bg-primary-solid px-3 py-2.5 shadow-lg">
        <p className="text-xs font-medium text-white">{children}</p>
        <AriaButton
          onPress={onDismiss}
          className="cursor-pointer rounded-sm text-xs font-semibold text-white underline outline-white focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Got it
        </AriaButton>
      </div>
    </AriaPopover>
  );
}
