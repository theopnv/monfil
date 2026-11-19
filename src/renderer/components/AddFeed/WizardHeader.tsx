// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useTranslation } from 'react-i18next';
import { X } from "@untitledui/icons";
import { Heading } from "react-aria-components";
import { Button } from "@/components/untitled-ui/base/buttons/button";
import { cx } from "@/components/untitled-ui/utils/cx";

export type WizardStep = 1 | 2 | 3;

const STEP_NAMES = { 1: "find", 2: "configure", 3: "done" } as const satisfies Record<WizardStep, string>;

type StepState = "done" | "current" | "todo";

function stepStateOf(dot: WizardStep, current: WizardStep): StepState {
  if (dot < current) {
    return "done";
  }
  if (dot === current) {
    return "current";
  }
  return "todo";
}

export interface WizardHeaderProps {
  step: WizardStep;
  maxStepReached: WizardStep;
  onStepClick: (step: WizardStep) => void;
  onClose: () => void;
}

export default function WizardHeader({ step, maxStepReached, onStepClick, onClose }: WizardHeaderProps) {
  const { t } = useTranslation('addFeed');

  return (
    <div className="flex flex-col gap-4.5 border-b border-secondary px-7.5 pt-6 pb-4.5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Heading slot="title" className="font-display text-display-xs leading-tight text-primary">
            {t(`wizard.titles.${STEP_NAMES[step]}`)}
          </Heading>
          <p className="mt-1 text-sm text-tertiary">{t(`wizard.blurbs.${STEP_NAMES[step]}`)}</p>
        </div>
        <Button aria-label={t('wizard.close')} size="xs" color="tertiary" className="rounded-full" iconLeading={X} onPress={onClose} />
      </div>

      <div className="flex items-center gap-2">
        {([1, 2, 3] as const).map((dot) => {
          const state = stepStateOf(dot, step);
          const isReachable = dot <= maxStepReached;
          return (
            <button
              key={dot}
              type="button"
              aria-label={t('wizard.goToStep', { step: dot, name: t(`wizard.step.${STEP_NAMES[dot]}`) })}
              aria-current={dot === step ? "step" : undefined}
              disabled={!isReachable}
              onClick={() => onStepClick(dot)}
              className={cx("flex flex-1 items-center gap-2", isReachable ? "cursor-pointer" : "cursor-not-allowed")}
            >
              <span
                className={cx(
                  "flex size-5.5 flex-none items-center justify-center rounded-full text-xs font-bold",
                  state === "done" && "bg-success-solid text-white",
                  state === "current" && "bg-brand-solid text-white",
                  state === "todo" && "bg-quaternary text-quaternary",
                )}
              >
                {dot}
              </span>
              <span className={cx("flex-none text-xs font-semibold whitespace-nowrap", state === "current" ? "text-primary" : "text-tertiary")}>
                {t(`wizard.step.${STEP_NAMES[dot]}`)}
              </span>
              {dot !== 3 && <span className={cx("h-0.5 min-w-3 flex-1 rounded-full", state === "done" ? "bg-success-solid/60" : "bg-quaternary")} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
