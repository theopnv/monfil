import { Button } from "@/components/untitled-ui/base/buttons/button";

export interface RiverControlsProps {
  unreadCount: number;
  sourceCount: number;
  onMarkAllRead: () => void;
}

export default function RiverControls({ unreadCount, sourceCount, onMarkAllRead }: RiverControlsProps) {
  return (
    <div className="flex flex-none items-center gap-3.5 border-b border-secondary px-8.5 py-3">
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
