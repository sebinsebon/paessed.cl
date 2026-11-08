"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, Flame, Route, Sparkles, Target, Trophy, Zap } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useLearning } from "@/components/learning/use-learning";
import { getLearningStats } from "@/lib/learning/engine";
import { M1_AXES, getM1Unit } from "@/lib/m1-curriculum";
import { DEFAULT_EXAMS } from "@/lib/default-exams";
import { LocalStorageDashboard } from "@/components/local-storage-dashboard";
import { usePersistentAppShell } from "@/components/persistent-app-shell";
import type { DailyGoal } from "@/lib/learning/types";

export function LearningHome() {
  const {state,profile,loading,error,refresh}=useLearning();
  const stats=state?getLearningStats(state):null;
  const next=state?.nodes.find(n=>n.state!=="completed");
  return <AppShell title="Inicio" eyebrow="Tu progreso M1">
    <header className="mb-8"><span className="inline-flex items-center gap-2 rounded-full bg-[var(--primary-soft)] px-3 py-2 text-xs font-extrabold text-[var(--primary)]"><Sparkles size={15}/>UN PASO MÁS CERCA</span><h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">Tu próxima conquista empieza aquí.</h1><p className="mt-3 max-w-xl text-sm leading-6 text-[var(--muted)]">Practica con una ruta que se adapta a tus respuestas. Cada avance se guarda en este navegador.</p></header>
    {error&&<p role="alert" className="mb-4 rounded-xl border border-rose-300 p-4">{error}<button onClick={()=>void refresh()} className="soft-button ml-3 rounded-lg p-2">Reintentar</button></p>}
    {loading?<p role="status">Leyendo tu progreso…</p>:<>
      <div className="mb-6 grid gap-3 sm:grid-cols-3">{[[Target,"Tu meta de hoy",`${stats?.today??0}/${stats?.goal??2} nodos`],[Flame,"Tu constancia",`${stats?.streak??0} días de racha`],[Zap,"Tu esfuerzo",`${stats?.xp??0} XP`]].map(([Icon,label,value])=>{const I=Icon as typeof Target;return <div key={String(label)} className="surface flex items-center gap-4 rounded-2xl p-5"><I size={24} className="text-[var(--primary)]"/><div><p className="text-xs text-[var(--muted)]">{String(label)}</p><p className="mt-1 text-xl font-extrabold">{String(value)}</p></div></div>;})}</div>
      <section className="surface-raised relative mb-8 overflow-hidden rounded-3xl border border-[var(--border)] p-6 sm:p-8"><Route className="absolute -right-6 -top-4 h-44 w-44 text-orange-500/10" strokeWidth={1}/><p className="text-xs font-extrabold uppercase tracking-widest text-[var(--primary)]">Tu siguiente paso</p><h2 className="relative mt-3 max-w-xl text-2xl font-extrabold">{!state?.diagnostic?.completedAt?"Descubre tu punto de partida":getM1Unit(next?.unitId??"")?.name??"Tu ruta te espera"}</h2><p className="relative mt-3 max-w-xl text-sm leading-6 text-[var(--muted)]">{!state?.diagnostic?.completedAt?"Un diagnóstico de 16 preguntas: una primera mirada a cada subeje, sin convertirla en una nota definitiva.":"Cinco preguntas para mantener tus bases y descubrir qué conviene reforzar."}</p><Link href="/app/aprender" className="tactile-primary relative mt-5 inline-flex min-h-12 items-center gap-3 rounded-xl px-6 text-sm font-extrabold">{state?.diagnostic?.completedAt?"Continuar mi ruta":"Preparar mi ruta"}<ArrowRight size={18}/></Link></section>
      <h2 className="mb-4 text-xl font-extrabold">Así va tu dominio</h2><div className="grid gap-4 sm:grid-cols-2">{M1_AXES.map(axis=>{const p=profile?.axes.find(a=>a.axisId===axis.id);return <section key={axis.id} className="surface rounded-2xl p-5"><div className="flex items-start justify-between gap-3"><h3 className="text-sm font-extrabold">{axis.name}</h3><strong className={p?.calibrated?"text-[var(--secondary)]":"text-[var(--muted)]"}>{p?.percent==null?"—":`${Math.round(p.percent)}%`}</strong></div><p className="mt-3 text-xs leading-5 text-[var(--muted)]">{p?.calibrated?"Estimación de dominio":"En calibración · "+(p?.count??0)+"/15 respuestas originales"} · {p?.coveredUnits??0}/{axis.units.length} subejes observados</p><div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface-3)]"><div className={"h-full rounded-full "+(p?.calibrated?"bg-[var(--secondary)]":"bg-slate-400")} style={{width:`${p?.percent??0}%`}}/></div></section>;})}</div>
      <section className="mt-8 grid gap-4 sm:grid-cols-2">{[[BookOpen,"Explora a tu ritmo","El mismo banco, con libertad para elegir qué practicar.","/app/playground"],[Trophy,"Practica un ensayo completo",`${DEFAULT_EXAMS.length} ensayos Gold disponibles, sin importar archivos.` ,"/app/ensayos"]].map(([Icon,title,text,href])=>{const I=Icon as typeof BookOpen;return <Link key={String(title)} href={String(href)} className="surface flex min-h-28 items-center gap-4 rounded-2xl p-5 hover:border-[var(--primary)]"><I size={26} className="shrink-0 text-[var(--secondary)]"/><div><h3 className="text-sm font-extrabold">{String(title)}</h3><p className="mt-2 text-xs leading-5 text-[var(--muted)]">{String(text)}</p></div><ArrowRight size={18} className="ml-auto shrink-0"/></Link>;})}</section>
    </>}
  </AppShell>;
}

export function LearningProfilePage(){
  const [timezone,setTimezone]=useState("Detectando…");
  useEffect(()=>{setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);},[]);
  const learning=useLearning();const {dark,setDark}=usePersistentAppShell();const stats=learning.state?getLearningStats(learning.state):null;
  return <AppShell title="Perfil" eyebrow="Tu espacio personal"><h1 className="text-3xl font-extrabold">Tu ritmo. Tu progreso.</h1><p className="mb-7 mt-3 text-sm text-[var(--muted)]">Perfil local · Tus datos se guardan en este navegador. Puedes exportar un respaldo para conservarlos.</p>
    {learning.error&&<p role="alert" className="mb-5 text-rose-600">{learning.error}</p>}
    <div className="grid gap-5 lg:grid-cols-2"><section className="surface rounded-2xl p-6"><h2 className="text-lg font-extrabold">Dedicación diaria</h2><p className="mt-2 text-xs text-[var(--muted)]">Una meta para orientarte; siempre puedes practicar más.</p><div className="mt-5 flex flex-wrap gap-3">{([1,2,3]as DailyGoal[]).map(goal=><button key={goal} className={"min-h-12 rounded-xl border px-5 font-extrabold "+((learning.state?.pendingGoal?.goal??stats?.goal)===goal?"border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]":"border-[var(--border)]")} aria-pressed={(learning.state?.pendingGoal?.goal??stats?.goal)===goal} onClick={()=>void learning.dispatch({type:"set-goal",goal})}>{goal} {goal===1?"nodo":"nodos"}</button>)}</div>{learning.state?.pendingGoal&&<p className="mt-3 text-xs text-[var(--muted)]">Tu nueva meta comienza mañana. Lo completado hoy se conserva.</p>}<p className="mt-5 text-xs text-[var(--muted)]">Zona horaria: {timezone}</p></section>
    <section className="surface rounded-2xl p-6"><h2 className="text-lg font-extrabold">Tu constancia</h2><div className="mt-5 grid grid-cols-3 gap-2">{[[stats?.streak??0,"días de racha"],[stats?.xp??0,"XP"],[learning.state?.nodes.filter(n=>n.state==="completed").length??0,"nodos completados"]].map(([value,label])=><div key={String(label)}><strong className="text-3xl">{value}</strong><p className="mt-2 text-xs text-[var(--muted)]">{label}</p></div>)}</div><button className="soft-button mt-6 min-h-11 rounded-xl px-4 text-sm font-bold" onClick={()=>setDark(!dark)}>{dark?"Usar tema claro":"Usar tema oscuro"}</button></section></div>
    <LocalStorageDashboard/>
  </AppShell>;
}
