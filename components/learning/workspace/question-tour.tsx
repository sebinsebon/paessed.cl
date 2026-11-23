"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { CircleHelp, Sparkles } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { scopedStorageKey } from "@/lib/sync/local";

type Context = "learn" | "diagnostic" | "exam" | "playground";
type Step = { id: string; selector: string; title: string; description: string };
type FocusRect = { top: number; bottom: number; left: number; right: number };

const tourKey = (mobile: boolean) => scopedStorageKey("paessed-question-tour-v1-" + (mobile ? "mobile" : "desktop"));
function getSteps(mobile: boolean, context: Context): Step[] {
  const action = context === "diagnostic"
    ? "Al elegir una alternativa aparece «Confirmar y continuar». En el diagnóstico no se revela la respuesta correcta al instante."
    : context === "exam"
      ? "Al elegir una alternativa aparece «Siguiente». También puedes recorrer el ensayo sin responder desde el menú."
      : "Al seleccionar una alternativa aparece el botón verde para comprobar; después podrás continuar.";
  return [
    {
      id: "pencil",
      selector: mobile ? '[data-testid="mobile-floating-pencil"]' : '[data-testid="pen-toolbox"]',
      title: "El lápiz ya está activo",
      description: mobile
        ? "Puedes empezar a escribir cálculos sobre la pregunta. El lápiz queda fijo abajo a la derecha; tócalo para cambiar entre dibujar y desplazarte."
        : "Puedes escribir directamente sobre la pregunta. El lápiz y sus herramientas están en la barra superior; vuelve a pulsarlo para desactivar el dibujo.",
    },
    {
      id: "ink",
      selector: '[data-testid="learning-paper-stem"]',
      title: "Dibuja y borra tus trazos",
      description: mobile
        ? "Empieza un trazo en la hoja. Para borrar uno, toca dos veces sobre él, incluso si cruza una alternativa. Usa dos dedos para desplazarte sin salir del dibujo."
        : "Dibuja sobre el enunciado o las figuras. Haz doble clic sobre un trazo para borrarlo individualmente, sin limpiar toda la hoja.",
    },
    {
      id: "answers",
      selector: '[role="radiogroup"] [role="radio"]',
      title: "Así funcionan las alternativas",
      description: "Un toque o clic elige una alternativa; el botón se hunde mientras lo presionas. Si empiezas a dibujar fuera, puedes continuar el trazo sobre ella sin seleccionarla.",
    },
    {
      id: "tools",
      selector: mobile ? '[data-testid="mobile-question-menu"]' : '[data-testid="pen-toolbox"]',
      title: mobile ? "Goma y ajustes en el menú" : "Goma y ajustes del lápiz",
      description: mobile
        ? "Abre las tres barras para encontrar la goma y los ajustes de grosor, colores y deshacer. El doble toque también borra trazos sin cambiar de herramienta."
        : "A la izquierda del lápiz se despliegan la goma y los ajustes. También puedes cambiar colores, deshacer o borrar trazos desde la configuración.",
    },
    {
      id: "actions",
      selector: '[role="radiogroup"]',
      title: "Responde cuando estés listo",
      description: action + " La tinta queda detrás de los botones de acción y no impide pulsarlos.",
    },
  ];
}

export function QuestionTour({ ready, mobile, context, replay, onVisibilityChange }: {
  ready: boolean;
  mobile: boolean;
  context: Context;
  replay: number;
  onVisibilityChange: (visible: boolean) => void;
}) {
  const reducedMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [focus, setFocus] = useState<FocusRect | null>(null);
  const checked = useRef<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const steps = getSteps(mobile, context);
  const step = steps[Math.min(index, steps.length - 1)];

  useEffect(() => {
    if (!ready) return;
    const key = tourKey(mobile);
    if (checked.current === key) return;
    checked.current = key;
    try {
      if (localStorage.getItem(key) === "1") return;
    } catch { /* If storage is unavailable, the guide still works this session. */ }
    setIndex(0);
    setOpen(true);
  }, [ready, mobile]);

  useEffect(() => {
    if (!replay) return;
    setIndex(0);
    setOpen(true);
  }, [replay]);

  useEffect(() => onVisibilityChange(open), [open, onVisibilityChange]);

  const close = () => {
    try { localStorage.setItem(tourKey(mobile), "1"); } catch { /* No persistent storage. */ }
    setOpen(false);
    setIndex(0);
  };

  useEffect(() => {
    if (!open) return;
    const target = Array.from(document.querySelectorAll<HTMLElement>(step.selector))
      .find(element => !!element.getClientRects().length);
    let frame = 0;
    let observer: ResizeObserver | undefined;
    let active = true;
    const measure = () => {
      frame = 0;
      if (!active || !target?.getClientRects().length) { setFocus(null); return; }
      const rect = target.getBoundingClientRect();
      const pad = 7;
      const width = window.innerWidth, height = window.innerHeight;
      const value = {
        top: Math.max(0, Math.min(height, rect.top - pad)),
        bottom: Math.max(0, Math.min(height, rect.bottom + pad)),
        left: Math.max(0, Math.min(width, rect.left - pad)),
        right: Math.max(0, Math.min(width, rect.right + pad)),
      };
      setFocus(previous => previous && Object.keys(value).every(key =>
        Math.abs(previous[key as keyof FocusRect] - value[key as keyof FocusRect]) < 0.5
      ) ? previous : value);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    // The question has its own scroll region; move the target into view only
    // when needed, then follow it while the user moves through the tutorial.
    if (target?.closest('[data-testid="learning-question-scroll"]')) {
      const bounds = target.getBoundingClientRect();
      if (bounds.bottom > window.innerHeight - 80 || bounds.top < 66) {
        target.scrollIntoView({ block: "center", behavior: reducedMotion ? "auto" : "smooth" });
      }
    }
    schedule();
    window.addEventListener("resize", schedule);
    document.addEventListener("scroll", schedule, true);
    if (target) {
      observer = new ResizeObserver(schedule);
      observer.observe(target);
    }
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", schedule);
      document.removeEventListener("scroll", schedule, true);
    };
  }, [open, step.selector, index, reducedMotion]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const first = panelRef.current?.querySelector<HTMLButtonElement>("button");
    first?.focus({ preventScroll: true });
    return () => { previous?.focus({ preventScroll: true }); };
  }, [open]);

  const onKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") { event.preventDefault(); close(); return; }
    if (event.key !== "Tab" || !panelRef.current) return;
    const buttons = Array.from(panelRef.current.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
    const first = buttons[0], last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };

  if (!open) return null;
  const shade = "absolute pointer-events-auto bg-slate-950/50 backdrop-blur-[1px]";
  const cardTop = !!focus && focus.top > windowHeight(mobile) * .56;
  const panelPlacement = cardTop ? { top: mobile ? 75 : 20 } : { bottom: mobile ? 16 : 24 };

  return <>
    <div data-testid="question-tour" className="pointer-events-none fixed inset-0 z-[115]" aria-hidden="true">
      {focus ? <>
        <div className={shade} style={{ top: 0, left: 0, right: 0, height: focus.top }} />
        <div className={shade} style={{ top: focus.bottom, left: 0, right: 0, bottom: 0 }} />
        <div className={shade} style={{ top: focus.top, left: 0, width: focus.left, height: Math.max(0, focus.bottom - focus.top) }} />
        <div className={shade} style={{ top: focus.top, left: focus.right, right: 0, height: Math.max(0, focus.bottom - focus.top) }} />
        <motion.div key={step.id} initial={reducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }}
          className="pointer-events-auto absolute rounded-[15px]" style={{
            top: focus.top, left: focus.left,
            width: Math.max(0, focus.right - focus.left), height: Math.max(0, focus.bottom - focus.top),
            outline: "3px solid var(--primary)",
          }} />
      </> : <div className={shade + " inset-0"} />}
    </div>
    <motion.div ref={panelRef} role="dialog" aria-modal="true" aria-label="Recorrido del visor de preguntas"
      data-testid="question-tour-panel" data-step={step.id} onKeyDown={onKeys}
      initial={reducedMotion ? false : { opacity: 0, y: 12, scale: .98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: reducedMotion ? 0 : .23, ease: [.22, 1, .36, 1] }}
      style={panelPlacement}
      className="fixed inset-x-3 z-[130] mx-auto w-[calc(100%-24px)] max-w-md overflow-y-auto rounded-2xl border border-[var(--pg-border)] bg-[var(--pg-bg)] p-4 text-[var(--pg-fg)] shadow-[0_16px_48px_#0005] sm:p-5"
    >
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--pg-selected)] text-[var(--primary)]"><Sparkles size={19} /></div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-extrabold uppercase tracking-widest text-[var(--pg-muted)]">Primer recorrido · {index + 1}/{steps.length}</div>
          <h2 className="mt-1 text-base font-extrabold">{step.title}</h2>
          <p className="mt-2 text-[13px] leading-5 text-[var(--pg-muted)]">{step.description}</p>
        </div>
      </div>
      <div className="mt-4 flex gap-1.5" aria-hidden="true">
        {steps.map((item, i) => <span key={item.id} className="h-1 flex-1 rounded-full" style={{ background: i <= index ? "var(--primary)" : "var(--pg-border)" }} />)}
      </div>
      <div className="mt-4 flex items-center justify-between gap-2">
        <button type="button" onClick={close} className="min-h-10 rounded-lg px-2 text-xs font-bold text-[var(--pg-muted)]">Omitir</button>
        <div className="flex items-center gap-2">
          {index > 0 && <button type="button" onClick={() => setIndex(i => i - 1)}
            className="min-h-10 rounded-lg border border-[var(--pg-border)] px-3 text-xs font-extrabold">Atrás</button>}
          <button type="button" onClick={() => index === steps.length - 1 ? close() : setIndex(i => i + 1)}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 text-xs font-extrabold text-white">
            {index === steps.length - 1 ? "Entendido" : "Siguiente"} <CircleHelp size={15} aria-hidden="true" />
          </button>
        </div>
      </div>
    </motion.div>
  </>;
}

// Read only while rendering a mounted, client-side walkthrough.
function windowHeight(mobile: boolean) {
  return typeof window === "undefined" ? (mobile ? 800 : 900) : window.innerHeight;
}
