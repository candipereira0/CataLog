import { useState, useEffect, useCallback } from "react";
import { getDeferredPrompt, clearDeferredPrompt } from "../main";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

interface InstallPromptState {
  /** Whether the browser supports PWA installation */
  isInstallable: boolean;
  /** Call to trigger the native install prompt */
  promptInstall: () => Promise<boolean>;
  /** Whether the user has dismissed our custom banner */
  dismissed: boolean;
  /** Dismiss the custom banner */
  dismiss: () => void;
}

const VISIT_COUNT_KEY = "catalog-install-visits";
const DISMISSED_KEY = "catalog-install-dismissed";
const MIN_VISITS = 3;

function getVisitCount(): number {
  try {
    const raw = localStorage.getItem(VISIT_COUNT_KEY);
    return raw ? parseInt(raw, 10) : 1;
  } catch {
    return 1;
  }
}

function incrementVisits(): number {
  const count = getVisitCount() + 1;
  try {
    localStorage.setItem(VISIT_COUNT_KEY, String(count));
  } catch {}
  return count;
}

function wasPromptDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

function setDismissed(): void {
  try {
    localStorage.setItem(DISMISSED_KEY, "1");
  } catch {}
}

/**
 * Hook that captures the beforeinstallprompt event and manages
 * a custom install banner. Shows the banner after MIN_VISITS page visits
 * if the app is installable and not yet installed.
 */
export function useInstallPrompt(): InstallPromptState {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissedState] = useState(wasPromptDismissed);
  const [visits, setVisits] = useState(getVisitCount);

  // Increment visit counter on mount
  useEffect(() => {
    setVisits(incrementVisits());
  }, []);

  // Listen for the custom event dispatched when beforeinstallprompt fires
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as BeforeInstallPromptEvent;
      if (detail) setDeferredPrompt(detail);
    };

    window.addEventListener("installpromptcaptured", handler);
    // Also check if it was already captured before this hook mounted
    const existing = getDeferredPrompt();
    if (existing) {
      setDeferredPrompt(existing as BeforeInstallPromptEvent);
    }

    return () => window.removeEventListener("installpromptcaptured", handler);
  }, []);

  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) return false;

    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;

    if (choice.outcome === "accepted") {
      setDeferredPrompt(null);
      clearDeferredPrompt();
      return true;
    }
    return false;
  }, [deferredPrompt]);

  const dismiss = useCallback(() => {
    setDismissed();
    setDismissedState(true);
  }, []);

  // Installable if we have a prompt event, the user hasn't dismissed,
  // and they have visited enough times
  const isInstallable = !!deferredPrompt && !dismissed && visits >= MIN_VISITS;

  return { isInstallable, promptInstall, dismissed, dismiss };
}
