import { Button } from "@/components/untitled-ui/base/buttons/button";

export interface WizardFooterProps {
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  primaryLoading?: boolean;
  secondaryLabel: string;
  onSecondary: () => void;
}

export default function WizardFooter({ primaryLabel, onPrimary, primaryDisabled, primaryLoading, secondaryLabel, onSecondary }: WizardFooterProps) {
  return (
    <div className="flex items-center justify-end gap-2.5 border-t border-secondary px-7.5 py-4.5">
      <Button color="secondary" size="md" className="rounded-full" onPress={onSecondary}>
        {secondaryLabel}
      </Button>
      <Button color="primary" size="md" className="rounded-full" isDisabled={primaryDisabled ?? false} isLoading={primaryLoading ?? false} onPress={onPrimary}>
        {primaryLabel}
      </Button>
    </div>
  );
}
