"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { animate, motion, useAnimationFrame, useMotionValue, useReducedMotion } from "motion/react";
import { BarChart3, Calculator, Sigma, Triangle } from "lucide-react";
import styles from "./landing.module.css";

// Extracted from the original dashboard's domain rail; public demo data only.
const axes = [
  { id: "numeros", name: "Números", percentage: 88, correct: 15, total: 17, state: "Dominado", weakest: "Potencias y raíces", color: "#10b981", tint: "#ecfdf5", darkTint: "#0b2a24", icon: Calculator },
  { id: "algebra", name: "Álgebra y funciones", percentage: 82, correct: 21, total: 25, state: "Fuerte", weakest: "Ecuaciones e inecuaciones", color: "#6366f1", tint: "#eef2ff", darkTint: "#1d2048", icon: Sigma },
  { id: "geometria", name: "Geometría", percentage: 38, correct: 6, total: 16, state: "Crítico", weakest: "Semejanza y proporcionalidad", color: "#ef4444", tint: "#fef2f2", darkTint: "#35171b", icon: Triangle },
  { id: "datos", name: "Probabilidad y estadística", percentage: 64, correct: 11, total: 17, state: "Regular", weakest: "Reglas de probabilidad", color: "#eab308", tint: "#fefce8", darkTint: "#332b0c", icon: BarChart3 },
];

// Same bright progress fills as the original dashboard rail.
function progressGradient(percentage: number) {
  if (percentage >= 85) return "linear-gradient(90deg, #b6f35c, #64db35)";
  if (percentage >= 75) return "linear-gradient(90deg, #c6ed4b, #83dc39)";
  if (percentage >= 60) return "linear-gradient(90deg, #f3c64a, #c4df40)";
  if (percentage >= 40) return "linear-gradient(90deg, #f6a34a, #ebca42)";
  return "linear-gradient(90deg, #ed5954, #f3953f)";
}

export function DomainCarousel() {
  const reducedPreference = useReducedMotion();
  // Keep SSR and the first client render identical; apply the media query after hydration.
  const [reduced, setReduced] = useState(false);
  useEffect(() => setReduced(!!reducedPreference), [reducedPreference]);
  const viewport = useRef<HTMLDivElement>(null), unit = useRef<HTMLDivElement>(null);
  const width = useRef(0), step = useRef(340), visible = useRef(false), hidden = useRef(false), interacting = useRef(false), focused = useRef(false);
  const drag = useRef<{ id: number; startX: number; startY: number; lastX: number; active: boolean } | null>(null);
  const x = useMotionValue(0);
  const wrap = (value: number) => width.current > 0 ? ((value % width.current) - width.current) % width.current : value;
  useEffect(() => {
    const measure = () => { width.current = unit.current?.getBoundingClientRect().width ?? 0; step.current = (unit.current?.firstElementChild?.getBoundingClientRect().width ?? 350) + 12; x.set(wrap(x.get())); };
    measure(); const observer = new ResizeObserver(measure); if (unit.current) observer.observe(unit.current);
    const intersection = new IntersectionObserver(([entry]) => { visible.current = entry.isIntersecting; }); if (viewport.current) intersection.observe(viewport.current);
    const visibility = () => { hidden.current = document.hidden; }; visibility(); document.addEventListener("visibilitychange", visibility);
    return () => { observer.disconnect(); intersection.disconnect(); document.removeEventListener("visibilitychange", visibility); };
  }, [x]);
  useAnimationFrame((_, delta) => {
    if (reduced || hidden.current || !visible.current || interacting.current || focused.current || drag.current) return;
    x.set(wrap(x.get() - 22 * Math.min(delta, 50) / 1000));
  });
  function move(direction: number) {
    const target = wrap(x.get() - direction * step.current);
    if (reduced || Math.abs(target - x.get()) > step.current * 1.5) x.set(target);
    else animate(x, target, { duration: .32, ease: [0.22, 1, .36, 1] });
  }
  function pointerDown(event: PointerEvent<HTMLDivElement>) { if (event.button !== 0) return; drag.current = { id: event.pointerId, startX: event.clientX, startY: event.clientY, lastX: event.clientX, active: false }; x.stop(); }
  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    const state = drag.current; if (!state || state.id !== event.pointerId) return;
    if (!state.active && Math.abs(event.clientY - state.startY) > Math.abs(event.clientX - state.startX) + 6) { drag.current = null; return; }
    if (!state.active && Math.abs(event.clientX - state.startX) > 6) { state.active = true; event.currentTarget.setPointerCapture(event.pointerId); }
    if (state.active) { x.set(wrap(x.get() + event.clientX - state.lastX)); event.preventDefault(); } state.lastX = event.clientX;
  }
  function pointerEnd(event: PointerEvent<HTMLDivElement>) { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); drag.current = null; }
  const cards = (duplicate = false) => <div className={styles.domainSet} ref={duplicate ? undefined : unit} aria-hidden={duplicate || undefined}>
    {axes.map(axis => { const Icon = axis.icon; return <article key={axis.id} className={styles.domainCard} style={{ "--axis": axis.color, "--axis-tint-light": axis.tint, "--axis-tint-dark": axis.darkTint, "--progress-fill": progressGradient(axis.percentage) } as CSSProperties}>
      <div className={styles.domainCardTop}><span className={styles.domainIcon}><Icon size={22} strokeWidth={2.2} /></span><div><h3>{axis.name}</h3><p>{axis.correct}/{axis.total} correctas</p></div><strong>{axis.percentage}%</strong></div>
      <div className={styles.progressTrack} aria-label={duplicate ? undefined : `Dominio de ejemplo en ${axis.name}: ${axis.percentage}%`}><div style={{ width: `${axis.percentage}%` }} /></div>
      <div className={styles.domainCardBottom}><span>{axis.state}</span><span>{axis.weakest}</span></div>
    </article>; })}
  </div>;
  return <section className={styles.domains} aria-label="Demostración de tu dominio M1">
    <div className={styles.domainHeading}><h2>Conoce tus fortalezas.<br /><span>Encuentra por dónde seguir.</span></h2><p>Los cuatro ejes de M1, en un solo lugar.<br />Tu mapa crece con cada respuesta.</p></div>
    <div ref={viewport} className={styles.carouselViewport} role="group" aria-roledescription="carrusel" aria-label="Ejes de Matemática M1; usa las flechas o arrastra" aria-description="Datos de ejemplo, no corresponden a tu progreso personal. Usa las flechas del teclado o arrastra para explorar. El movimiento automático se detiene al pasar el cursor o enfocar el carrusel." tabIndex={0}
      onMouseEnter={() => { interacting.current = true; }} onMouseLeave={() => { interacting.current = false; }}
      onFocusCapture={() => { focused.current = true; }} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) focused.current = false; }}
      onKeyDown={event => { if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); move(event.key === "ArrowRight" ? 1 : -1); } }}
      onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd}>
      <motion.div className={styles.domainTrack} style={{ x }}>{cards()}{cards(true)}{cards(true)}</motion.div>
    </div>
  </section>;
}
