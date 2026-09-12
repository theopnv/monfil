interface Shortcut {
  key: string;
  description: string;
}

const SHORTCUTS: Shortcut[] = [
  { key: "J", description: "next" },
  { key: "K", description: "previous" },
  { key: "Esc", description: "back to Home" },
];

export default function KeyboardShortcutsHint() {
  return (
    <div className="mb-8.5 flex items-center justify-center gap-4 text-sm text-tertiary">
      {SHORTCUTS.map(({ key, description }) => (
        <span key={key} className="flex items-center gap-1.5">
          <kbd className="rounded-md border border-secondary px-1.5 py-0.5 font-mono text-xs text-secondary">{key}</kbd>
          <span>{description}</span>
        </span>
      ))}
    </div>
  );
}
