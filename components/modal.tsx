"use client";

import { useEffect, useRef, type ReactNode } from "react";
import styles from "./modal.module.css";

/** One native top-layer surface: background is inert and keyboard stays inside. */
export function Modal({ children, labelledBy, describedBy, onDismiss, className = "" }: { children: ReactNode; labelledBy: string; describedBy?: string; onDismiss: () => void; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    // Start on the explanation, rather than selecting a decision for the user.
    (dialog.querySelector<HTMLElement>("[data-modal-heading], h1, h2") ?? dialog).focus({ preventScroll: true });
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  return <dialog ref={ref} tabIndex={-1} aria-labelledby={labelledBy} aria-describedby={describedBy} className={`${styles.dialog} ${className}`}
    onCancel={event => { event.preventDefault(); onDismiss(); }}
    onKeyDown={event => {
      if (event.key !== "Tab") return;
      const items = Array.from(ref.current?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]') ?? []).filter(item => item.getClientRects().length > 0);
      if (!items.length) { event.preventDefault(); return; }
      const first = items[0], last = items[items.length - 1], focused = document.activeElement;
      if (event.shiftKey && (focused === first || !items.includes(focused as HTMLElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (focused === last || !items.includes(focused as HTMLElement))) { event.preventDefault(); first.focus(); }
    }}>{children}</dialog>;
}
