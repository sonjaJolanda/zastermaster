import type { ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Render overlays on document.body so `position: fixed` is viewport-relative.
 * (`.zm-surface` uses backdrop-filter, which otherwise traps fixed descendants.)
 */
export function OverlayPortal({ children }: { children: ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}
