import { useEffect } from "react";

type Modifier = "cmd" | "ctrl" | "shift" | "alt";

interface HotkeyOptions {
  key: string;
  modifiers?: Modifier[];
  onTrigger: () => void;
  enabled?: boolean;
}

export function useHotkey({ key, modifiers = [], onTrigger, enabled = true }: HotkeyOptions) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      // Don't fire when typing in inputs/textareas unless it's an escape
      if (key !== "Escape" && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;

      const wantsMeta = modifiers.includes("cmd");
      const wantsCtrl = modifiers.includes("ctrl");
      const wantsShift = modifiers.includes("shift");
      const wantsAlt = modifiers.includes("alt");

      if (wantsMeta && !e.metaKey) return;
      if (wantsCtrl && !e.ctrlKey) return;
      if (wantsShift && !e.shiftKey) return;
      if (wantsAlt && !e.altKey) return;
      if (!wantsMeta && e.metaKey) return;
      if (!wantsCtrl && e.ctrlKey && !wantsMeta) return;

      if (e.key.toLowerCase() !== key.toLowerCase()) return;

      e.preventDefault();
      onTrigger();
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [key, modifiers, onTrigger, enabled]);
}

export function useHotkeys(bindings: HotkeyOptions[]) {
  useEffect(() => {
    const handlers = bindings.map((b) => {
      const handler = (e: KeyboardEvent) => {
        if (!b.enabled && b.enabled !== undefined) return;
        const target = e.target as HTMLElement;
        if (b.key !== "Escape" && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;

        const mods = b.modifiers ?? [];
        if (mods.includes("cmd") && !e.metaKey) return;
        if (mods.includes("ctrl") && !e.ctrlKey) return;
        if (mods.includes("shift") && !e.shiftKey) return;
        if (mods.includes("alt") && !e.altKey) return;
        if (!mods.includes("cmd") && !mods.includes("ctrl") && (e.metaKey || e.ctrlKey)) return;

        if (e.key.toLowerCase() !== b.key.toLowerCase()) return;
        e.preventDefault();
        b.onTrigger();
      };
      window.addEventListener("keydown", handler);
      return handler;
    });

    return () => handlers.forEach((h) => window.removeEventListener("keydown", h));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
