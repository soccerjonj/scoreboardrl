import { Component, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const attemptRecoverFromChunkError = () => {
  const key = "vite_chunk_error_reloaded";
  if (!sessionStorage.getItem(key)) {
    sessionStorage.setItem(key, "1");
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
type RootErrorBoundaryState = { hasError: boolean };

class RootErrorBoundary extends Component<RootErrorBoundaryProps, RootErrorBoundaryState> {
  state: RootErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): RootErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _errorInfo: ErrorInfo) {}

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
          <div className="max-w-md text-center space-y-3">
            <p className="font-display font-bold text-lg">Something went wrong loading the app.</p>
            <p className="text-sm text-muted-foreground">Please refresh to load the latest version.</p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium"
            >
              Reload
            </button>
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
