"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./mobile-question.module.css";

/** Measure the rendered bank content at the candidate cell width after fonts load. */
export function AdaptiveAlternatives({ children, frozen, contentKey }: { children: ReactNode; frozen: boolean; contentKey: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const pressed = useRef(false);
  const frozenRef = useRef(frozen);
  frozenRef.current = frozen;
  const [layout, setLayout] = useState<"grid" | "column">("column");
  useEffect(() => {
    const group = ref.current;
    if (!group) return;
    let disposed = false;
    let frame = 0;
    const measure = () => {
      if (disposed || pressed.current) return;
      const saved = group.closest<HTMLElement>("[data-ink-option-layout]")?.dataset.inkOptionLayout;
      if (saved === "grid" || saved === "column") { setLayout(saved); return; }
      if (frozenRef.current) return;
      if (!matchMedia("(max-width: 767px)").matches) { setLayout("column"); return; }
      let fits = group.clientWidth > 100;
      for (const content of group.querySelectorAll<HTMLElement>("[data-option-content]")) {
        if (!fits) break;
        if (content.querySelector("img,table,.paessed-unresolved")) { fits = false; break; }
        const button = content.parentElement!;
        const buttonStyle = getComputedStyle(button);
        const contentStyle = getComputedStyle(content);
        const siblingsWidth = Array.from(button.children).filter(child => child !== content).reduce((sum, child) => sum + child.getBoundingClientRect().width, 0);
        const width = (group.clientWidth - 8) / 2 - parseFloat(buttonStyle.paddingLeft) - parseFloat(buttonStyle.paddingRight) - siblingsWidth - (parseFloat(buttonStyle.columnGap) || 0) * 2 - 2;
        if (width <= 30) { fits = false; break; }
        const probe = content.cloneNode(true) as HTMLElement;
        probe.style.cssText = `position:fixed;left:-10000px;top:0;width:${width}px;max-width:none;visibility:hidden;pointer-events:none;font-size:${contentStyle.fontSize};line-height:${contentStyle.lineHeight};`;
        probe.setAttribute("aria-hidden", "true");
        group.appendChild(probe);
        const lineHeight = parseFloat(contentStyle.lineHeight) || parseFloat(contentStyle.fontSize) * 1.5;
        fits = probe.getBoundingClientRect().height <= lineHeight * 2 + 1 && probe.scrollWidth <= probe.clientWidth + 1;
        for (const descendant of probe.querySelectorAll<HTMLElement>(".katex,.paessed-math,.paessed-paragraph")) {
          if (descendant.scrollWidth > width + 1 || descendant.getBoundingClientRect().width > width + 1) fits = false;
        }
        probe.remove();
      }
      setLayout(fits ? "grid" : "column");
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    void document.fonts.ready.then(schedule);
    const resize = new ResizeObserver(schedule);
    resize.observe(group);
    const mutation = new MutationObserver(records => { if (records.some(record => record.target !== group)) schedule(); });
    mutation.observe(group, { childList: true, subtree: true });
    const release = () => { pressed.current = false; schedule(); };
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    return () => { disposed = true; resize.disconnect(); mutation.disconnect(); cancelAnimationFrame(frame); window.removeEventListener("pointerup", release); window.removeEventListener("pointercancel", release); };
  }, [contentKey]);
  return <div ref={ref} role="radiogroup" aria-label="Alternativas" data-layout={layout} className={`${styles.options} flex max-w-[1060px] flex-col items-start gap-1.5 pt-5 sm:pt-7`} onPointerDownCapture={() => { pressed.current = true; }}>{children}</div>;
}
