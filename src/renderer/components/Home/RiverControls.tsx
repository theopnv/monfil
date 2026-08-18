import { Button } from "@/components/untitled-ui/base/buttons/button";

export type Density = "Cards" | "Magazine" | "Compact";

const DENSITIES: Density[] = ["Cards", "Magazine", "Compact"];

export interface RiverControlsProps {
  density: Density;
  onDensityChange: (density: Density) => void;
  unreadCount: number;
  sourceCount: number;
  onMarkAllRead: () => void;
}

export default function RiverControls({ density, onDensityChange, unreadCount, sourceCount, onMarkAllRead }: RiverControlsProps) {
  return (
    <div className="flex flex-none items-center gap-3.5 border-b border-secondary px-8.5 py-3">
      <div className="flex gap-0.5 rounded-full bg-primary_hover p-0.75">
        {DENSITIES.map((option) => (
          <Button
            key={option}
            size="sm"
            color={option === density ? "secondary" : "tertiary"}
            className="rounded-full"
            onPress={() => onDensityChange(option)}
          >
            {option}
          </Button>
        ))}
      </div>

      <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-sm text-tertiary">
        {unreadCount} unread · {sourceCount} sources
      </span>

      <div className="ml-auto flex items-center gap-2">
        <Button color="link-color" size="sm" onPress={onMarkAllRead}>
          Mark all read
        </Button>
      </div>
    </div>
  );
}
