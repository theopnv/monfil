import { useEffect, useRef, useState } from "react";
import { subscribeToAnnouncements } from "@/lib/announcer";

/**
 * The app's single `aria-live` region, mounted once in AppShell. Screen readers
 * only announce a live region when its text changes, so a repeated message is
 * cleared first and set again on a short delay.
 */
export default function LiveRegion() {
  const [message, setMessage] = useState("");
  const clearTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => subscribeToAnnouncements((next) => {
    clearTimeout(clearTimer.current);
    setMessage("");
    clearTimer.current = setTimeout(() => setMessage(next), 50);
  }), []);

  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </div>
  );
}
