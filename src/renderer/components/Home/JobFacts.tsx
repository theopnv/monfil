// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useTranslation } from 'react-i18next';
import { cx } from "@/components/untitled-ui/utils/cx";
import type { JobDetails } from "../../../shared/contracts";

const WORK_MODE_KEY = { remote: "job.remote", hybrid: "job.hybrid", "on-site": "job.onSite" } as const;

export default function JobFacts({ job, className }: { job: JobDetails; className?: string }) {
  const { t } = useTranslation('river');
  const place = [job.company, job.location].filter((part): part is string => part !== undefined).join(" · ");
  const modeKey = job.workMode === undefined ? undefined : WORK_MODE_KEY[job.workMode as keyof typeof WORK_MODE_KEY];
  const mode = modeKey === undefined ? undefined : t(modeKey);

  return (
    <div className={cx("flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-secondary", className)}>
      {place && <span>{place}</span>}
      {mode && <span className="rounded-full bg-brand-secondary px-2.5 py-0.5 text-xs font-semibold text-brand-secondary">{mode}</span>}
      <span className={job.salaryLabel ? "font-semibold text-primary" : "text-tertiary"}>{job.salaryLabel ?? t('job.salaryNotShown')}</span>
    </div>
  );
}
