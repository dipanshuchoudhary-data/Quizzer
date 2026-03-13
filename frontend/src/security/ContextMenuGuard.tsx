"use client";

import { useEffect } from "react";
import { useViolationReporter } from "@/hooks/useViolationReporter";

export function ContextMenuGuard({ enabled }: { enabled: boolean }) {
  const { reportViolation } = useViolationReporter();

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const onContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      void reportViolation("CONTEXT_MENU");
    };

    const onCopy = (event: ClipboardEvent) => {
      event.preventDefault();
      void reportViolation("COPY_ATTEMPT");
    };

    const onCut = (event: ClipboardEvent) => {
      event.preventDefault();
      void reportViolation("COPY_ATTEMPT");
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const modifier = event.ctrlKey || event.metaKey;
      const blockedCombo =
        event.key === "F12" ||
        (modifier && event.shiftKey && ["i", "j", "c"].includes(key)) ||
        (modifier && ["u", "s", "c", "v", "x"].includes(key));

      if (blockedCombo) {
        event.preventDefault();
        if (key === "v") {
          void reportViolation("PASTE_ATTEMPT");
          return;
        }
        if (key === "c" || key === "x") {
          void reportViolation("COPY_ATTEMPT");
          return;
        }
        void reportViolation("DEVTOOLS_SHORTCUT");
      }
    };

    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("copy", onCopy);
    document.addEventListener("cut", onCut);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("cut", onCut);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [enabled, reportViolation]);

  return null;
}
