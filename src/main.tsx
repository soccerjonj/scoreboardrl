import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

window.addEventListener("vite:preloadError", (event) => {
  // Recover from stale hashed chunks after deploy/PWA update by forcing a one-time refresh.
  event.preventDefault();
  const key = "vite_preload_error_reloaded";
  if (!sessionStorage.getItem(key)) {
    sessionStorage.setItem(key, "1");
    window.location.reload();
  }
});

createRoot(document.getElementById("root")!).render(<App />);
