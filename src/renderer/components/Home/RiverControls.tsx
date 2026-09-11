export interface RiverControlsProps {
  unreadCount: number;
  sourceCount: number;
}

export default function RiverControls({ unreadCount, sourceCount }: RiverControlsProps) {
  return (
    <div className="flex flex-none items-center gap-3.5 border-b border-secondary px-8.5 py-3">
      <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-sm text-tertiary">
        {unreadCount} unread · {sourceCount} feeds
      </span>
    </div>
  );
}
