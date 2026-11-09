"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode, type RefObject } from "react";
import { X } from "lucide-react";
import styles from "./mobile-question.module.css";

export function QuestionDialog({ title, onClose, children, wide = false, paperStyle, returnFocusRef }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean; paperStyle?: CSSProperties; returnFocusRef?: RefObject<HTMLElement | null> }) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const dialog = ref.current;
    // Safari touch clicks may leave focus on body; the expanded trigger is the
    // stable keyboard return point for the mobile tool menu in that case.
    const active = document.activeElement as HTMLElement | null;
    const origin = returnFocusRef?.current ?? (active && active !== document.body && !dialog?.contains(active) ? active : document.querySelector<HTMLElement>('[aria-label="Abrir menú de la pregunta"][aria-expanded="true"]'));
    const mobile = matchMedia("(max-width: 767px)").matches;
    if (mobile || wide) dialog?.showModal(); else dialog?.show();
    const fit = () => {
      if (!dialog || (!mobile && !wide)) return;
      const viewport = window.visualViewport;
      dialog.style.maxHeight = `${Math.max(120, (viewport?.height ?? window.innerHeight) - 24)}px`;
      dialog.style.top = `${(viewport?.offsetTop ?? 0) + 12}px`;
      dialog.style.bottom = "auto";
      dialog.style.marginBlock = "0";
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && !mobile && !wide) close.current(); };
    fit(); window.visualViewport?.addEventListener("resize", fit); window.visualViewport?.addEventListener("scroll", fit);
    window.addEventListener("keydown", escape);
    return () => { window.visualViewport?.removeEventListener("resize", fit); window.visualViewport?.removeEventListener("scroll", fit); window.removeEventListener("keydown", escape); dialog?.close(); origin?.focus({ preventScroll: true }); };
  }, [wide]);
  return <dialog ref={ref} style={paperStyle} aria-label={title} className={`${styles.dialog} ${wide ? styles.figureDialog : ""}`} onCancel={event => { event.preventDefault(); close.current(); }} onClick={event => { if (event.target === event.currentTarget) { const r = event.currentTarget.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) close.current(); } }}>
    <div className={styles.dialogHeader}><h2>{title}</h2><button type="button" className={styles.iconButton} aria-label={`Cerrar ${title.toLowerCase()}`} onClick={onClose} autoFocus><X size={20} /></button></div>
    {children}
  </dialog>;
}
