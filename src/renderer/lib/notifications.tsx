import { Toaster, toast } from 'sonner';

const activeKeys = new Set<string>();

export function notifyError(message: string, key = message): void {
  if (activeKeys.has(key)) {
    return;
  }
  activeKeys.add(key);
  toast.error(message, { id: key, onDismiss: () => activeKeys.delete(key), onAutoClose: () => activeKeys.delete(key) });
}

export function notifyWarning(message: string, key = message, action?: { label: string; onClick: () => void }): void {
  if (activeKeys.has(key)) {
    return;
  }
  activeKeys.add(key);
  toast.warning(message, { id: key, action, duration: Infinity, onDismiss: () => activeKeys.delete(key), onAutoClose: () => activeKeys.delete(key) });
}

export function NotificationHost() {
  return <Toaster richColors position="bottom-right" />;
}
