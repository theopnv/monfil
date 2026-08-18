import { Button } from "@/components/untitled-ui/base/buttons/button";

export interface SegmentedControlProps<T extends string | number> {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  getLabel?: (option: T) => string;
}

export default function SegmentedControl<T extends string | number>({ options, value, onChange, getLabel }: SegmentedControlProps<T>) {
  return (
    <div className="flex gap-0.5 rounded-full bg-primary_hover p-0.75">
      {options.map((option) => (
        <Button
          key={option}
          size="sm"
          color={option === value ? "secondary" : "tertiary"}
          className="rounded-full"
          aria-pressed={option === value}
          onPress={() => onChange(option)}
        >
          {getLabel ? getLabel(option) : String(option)}
        </Button>
      ))}
    </div>
  );
}
