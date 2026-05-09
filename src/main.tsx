import { Component, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const RECOVERY_KEY = "vite_chunk_error_reloaded_at";
const RECOVERY_TTL_MS = 30_000; // a recovery flag older than 30s is stale; allow another reload

// On fresh page loads, clear stale recovery flags so the auto-reload mechanism
// keeps working across visits (sessionStorage is per-tab and previously could
// pin a tab into "no more reloads" forever after a single chunk error).
const stamp = sessionStorage.getItem(RECOVERY_KEY);
if (stamp && Date.now() - Number(stamp) > RECOVERY_TTL_MS) {
  sessionStorage.removeItem(RECOVERY_KEY);
}

const attemptRecoverFromChunkError = () => {
  if (!sessionStorage.getItem(RECOVERY_KEY)) {
    sessionStorage.setItem(RECOVERY_KEY, String(Date.now()));
    window.location.reload();
  }
};

window.addEventListener("vite:preloadError", (event) => {
  // Recover from stale hashed chunks after deploy/PWA update by forcing a one-time refresh.
  event.preventDefault();
  attemptRecoverFromChunkError();
});

window.addEventListener("error", (event) => {
  const message = event.message || "";
  if (message.includes("Failed to fetch dynamically imported module")) {
    attemptRecoverFromChunkError();
  }
});

window.addEventListener("unhandledrejection", (event) => {
  const reason = String(event.reason || "");
  if (reason.includes("Failed to fetch dynamically imported module")) {
    event.preventDefault();
    attemptRecoverFromChunkError();
  }
});

type RootErrorBoundaryProps = { children: ReactNode };
type RootErrorBoundaryState = { hasError: boolean; errorMessage: string | null };

class RootErrorBoundary extends Component<RootErrorBoundaryProps, RootErrorBoundaryState> {
  state: RootErrorBoundaryState = { hasError: false, errorMessage: null };

  static getDerivedStateFromError(error: Error): RootErrorBoundaryState {
    return { hasError: true, errorMessage: error?.message ?? String(error) };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Surface the real error to the console so users can report what they see.
    // Errors raised here often indicate a stale chunk after a deploy.
    // eslint-disable-next-line no-console
    console.error("App crashed at root boundary:", error, errorInfo);
  }

  handleHardReload = () => {
    sessionStorage.removeItem(RECOVERY_KEY);
    // Bust caches by appending a query string the SW can't intercept identically
    const url = new URL(window.location.href);
    url.searchParams.set("_reload", String(Date.now()));
    window.location.replace(url.toString());
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
          <div className="max-w-md text-center space-y-3">
            <p className="font-display font-bold text-lg">Something went wrong loading the app.</p>
            <p className="text-sm text-muted-foreground">Please refresh to load the latest version.</p>
            {this.state.errorMessage && (
              <p className="text-xs font-mono text-muted-foreground/60 break-all px-2">
                {this.state.errorMessage}
              </p>
            )}
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center justify-center h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium"
              >
                Reload
              </button>
              <button
                onClick={this.handleHardReload}
                className="inline-flex items-center justify-center h-9 px-4 rounded-md bg-card border border-border text-sm font-medium"
              >
                Hard Reload
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <RootErrorBoundary>
    <App />
  </RootErrorBoundary>
);
