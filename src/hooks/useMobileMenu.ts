import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

/**
 * Shared behaviour for the mobile navigation panel in every public header.
 *
 * A disclosure menu that only closes by clicking its own button is a trap on
 * touch and keyboard alike, so this owns the three rules every header needs:
 * Escape closes it, a route change closes it, and the page behind it does not
 * scroll while it is open.
 */
export function useMobileMenu() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((v) => !v), []);

  // Route changes close the panel: the destination is already rendering behind it.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  return { open, setOpen, close, toggle };
}

export default useMobileMenu;
