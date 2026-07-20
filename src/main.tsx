import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { PlayerProvider } from "./contexts/PlayerContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import App from "./App";
import "./index.css";

// ─── Service Worker Registration with Update Handling ───
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").then((registration) => {
    // Check for updates when the page loads
    registration.update().catch(() => {});

    // Listen for new service worker waiting
    registration.addEventListener("updatefound", () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener("statechange", () => {
        if (
          newWorker.state === "installed" &&
          navigator.serviceWorker.controller
        ) {
          // New content is available — show update toast
          showUpdateToast(registration);
        }
      });
    });
  }).catch((err) => {
    console.warn("Service worker registration failed:", err);
  });

  // Also detect updates via controllerchange (e.g. skipWaiting called)
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
}

function showUpdateToast(registration: ServiceWorkerRegistration) {
  // Don't show multiple toasts
  if (document.getElementById("sw-update-toast")) return;

  const toast = document.createElement("div");
  toast.id = "sw-update-toast";
  toast.style.cssText = `
    position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
    z-index: 9999; background: #7c3aed; color: white; padding: 12px 20px;
    border-radius: 12px; font-size: 14px; font-family: Inter, system-ui, sans-serif;
    font-weight: 500; box-shadow: 0 8px 32px rgba(124,58,237,0.4);
    display: flex; align-items: center; gap: 12px;
    animation: sw-slide-up 0.3s ease-out;
    max-width: 90vw;
  `;
  toast.innerHTML = `
    <span>New version available</span>
    <button id="sw-update-btn" style="
      background: white; color: #7c3aed; border: none; padding: 6px 14px;
      border-radius: 8px; font-weight: 600; cursor: pointer; font-family: inherit;
      font-size: 13px;
    ">Refresh</button>
  `;
  document.body.appendChild(toast);

  document.getElementById("sw-update-btn")!.addEventListener("click", () => {
    if (registration.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    }
    toast.remove();
    window.location.reload();
  });

  // Auto-dismiss after 30s
  setTimeout(() => toast.remove(), 30000);
}

// Inject keyframe animation
const style = document.createElement("style");
style.textContent = `
  @keyframes sw-slide-up {
    from { opacity: 0; transform: translateX(-50%) translateY(20px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
  }
`;
document.head.appendChild(style);

// ─── Install Prompt Capture ───
// Capture the beforeinstallprompt event globally so hooks can access it.
// The useInstallPrompt hook reads from this module-level variable.
let _deferredInstallPrompt: Event | null = null;

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  _deferredInstallPrompt = e;
  // Dispatch a custom event so React hooks can pick it up
  window.dispatchEvent(new CustomEvent("installpromptcaptured", { detail: e }));
});

// Expose for the useInstallPrompt hook
export function getDeferredPrompt(): Event | null {
  return _deferredInstallPrompt;
}

export function clearDeferredPrompt(): void {
  _deferredInstallPrompt = null;
}

// ─── Render App ───
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <PlayerProvider>
            <App />
          </PlayerProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>
);
