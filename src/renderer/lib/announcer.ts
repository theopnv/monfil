type Listener = (message: string) => void;

const listeners = new Set<Listener>();

/**
 * Pushes `message` to every mounted `LiveRegion` (normally the single one in
 * AppShell). A test that renders a component in isolation, without AppShell,
 * has no listener, so this is a silent no-op rather than touching the DOM.
 */
export function announce(message: string): void {
  for (const listener of listeners) {
    listener(message);
  }
}

export function subscribeToAnnouncements(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
