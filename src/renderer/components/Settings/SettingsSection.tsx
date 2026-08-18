import type { PropsWithChildren, ReactNode } from "react";

export interface SettingsSectionProps extends PropsWithChildren {
  id: string;
  title: string;
  description?: ReactNode;
}

export default function SettingsSection({ id, title, description, children }: SettingsSectionProps) {
  return (
    <section id={id} className="flex flex-col gap-5 border-b border-secondary pb-8 last:border-b-0">
      <div>
        <h2 className="text-lg font-bold text-primary">{title}</h2>
        {description && <p className="mt-1 text-sm text-tertiary">{description}</p>}
      </div>
      {children}
    </section>
  );
}
