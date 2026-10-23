// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { cx } from "@/components/untitled-ui/utils/cx";
import type { JobDetails } from "../../../shared/contracts";

export const SALARY_NOT_SHOWN = "salary not shown";

const WORK_MODE_LABEL: Record<string, string> = { remote: "Remote", hybrid: "Hybrid", "on-site": "On-site" };

/** Company, place, work mode and pay of a job, read from the item's `extra` JSON. */
export default function JobFacts({ job, className }: { job: JobDetails; className?: string }) {
  const place = [job.company, job.location].filter((part): part is string => part !== undefined).join(" · ");
  const mode = job.workMode ? WORK_MODE_LABEL[job.workMode] : undefined;

  return (
    <div className={cx("flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-secondary", className)}>
      {place && <span>{place}</span>}
      {mode && <span className="rounded-full bg-brand-secondary px-2.5 py-0.5 text-xs font-semibold text-brand-secondary">{mode}</span>}
      <span className={job.salaryLabel ? "font-semibold text-primary" : "text-tertiary"}>{job.salaryLabel ?? SALARY_NOT_SHOWN}</span>
    </div>
  );
}
