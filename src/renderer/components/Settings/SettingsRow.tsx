import type { PropsWithChildren, ReactNode } from "react";

export interface SettingsRowProps extends PropsWithChildren {
  label: string;
  hint?: ReactNode;
}

export default function SettingsRow({ label, hint, children }: SettingsRowProps) {
  return (
    <div className="flex items-center justify-between gap-6">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-secondary">{label}</span>
        {hint && <span className="text-sm text-tertiary">{hint}</span>}
      </div>
      <div className="flex-none">{children}</div>
    </div>
  );
}
