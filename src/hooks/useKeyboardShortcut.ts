import { useEffect } from "react";

type KeyHandler = (e: KeyboardEvent) => void;

interface ShortcutDef {
  key: string;
  handler: KeyHandler;
  /** When true, ignore the shortcut if the user is typing in an input/textarea */
  ignoreInputs?: boolean;
}

/**
 * Register global keyboard shortcuts.
 * Pass an array of { key, handler, ignoreInputs? } definitions.
 * Keys are matched case-insensitively.
 */
export function useKeyboardShortcut(shortcuts: ShortcutDef[]) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Don't fire when modifier keys are held (except for plain letter shortcuts)
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      for (const shortcut of shortcuts) {
        if (e.key.toLowerCase() === shortcut.key.toLowerCase()) {
          // Skip if user is typing in an input
          if (shortcut.ignoreInputs !== false) {
            const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
            const isInput =
              tag === "input" ||
              tag === "textarea" ||
              tag === "select" ||
              (e.target as HTMLElement)?.isContentEditable;
            if (isInput) return;
          }
          shortcut.handler(e);
          break;
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [shortcuts]);
}
