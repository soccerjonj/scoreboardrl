import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const CONSENT_KEY = "cookie_consent_dismissed";

/**
 * Minimal essential-cookies notice. We only use cookies/local storage that are
 * strictly necessary (keeping you signed in + remembering basic UI state), so
 * this is an acknowledgement banner rather than a granular consent manager.
 * Dismissal is remembered in localStorage.
 */
export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(CONSENT_KEY)) setVisible(true);
    } catch {
      /* private mode / storage blocked — just don't show it */
    }
  }, []);

  const dismiss = () => {
    try { window.localStorage.setItem(CONSENT_KEY, String(Date.now())); } catch { /* ignore */ }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] p-3 sm:p-4">
      <div className="max-w-3xl mx-auto rounded-xl border border-border/60 bg-card/95 backdrop-blur-md shadow-lg px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <p className="text-xs text-muted-foreground flex-1">
          We use only essential cookies to keep you signed in and remember basic preferences. See our{" "}
          <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
        </p>
        <Button size="sm" variant="hero" className="shrink-0" onClick={dismiss}>
          Got it
        </Button>
      </div>
    </div>
  );
}
