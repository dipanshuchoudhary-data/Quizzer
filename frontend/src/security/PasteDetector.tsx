"use client";

import { useEffect, useRef } from "react";
import { useViolationReporter } from "@/hooks/useViolationReporter";

export function PasteDetector({ enabled }: { enabled: boolean }) {
  const { reportViolation } = useViolationReporter();
  const inputTimeline = useRef<Map<EventTarget, { at: number; length: number }>>(new Map());

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const timeline = inputTimeline.current;

    const onPaste = (event: ClipboardEvent) => {
      event.preventDefault();
      void reportViolation("PASTE_ATTEMPT");
    };

    const onInput = (event: Event) => {
      const target = event.target as HTMLTextAreaElement | null;
      if (!target || target.tagName !== "TEXTAREA") {
        return;
      }

      const now = Date.now();
      const currentLength = target.value.length;
      const previous = timeline.get(target);
      timeline.set(target, { at: now, length: currentLength });

      if (!previous) {
        return;
      }

      const delta = currentLength - previous.length;
      const elapsed = now - previous.at;
      if (delta > 200 && elapsed < 1_000) {
        void reportViolation("LARGE_TEXT_INSERT");
      }
    };

    document.addEventListener("paste", onPaste);
    document.addEventListener("input", onInput);

    return () => {
      document.removeEventListener("paste", onPaste);
      document.removeEventListener("input", onInput);
      timeline.clear();
    };
  }, [enabled, reportViolation]);

  return null;
}
