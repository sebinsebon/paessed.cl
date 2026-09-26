'use client';
import Link from 'next/link';
import { ArrowRight, ChartNoAxesCombined, ShieldCheck, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getOutcome, readAccount, readDiagnostic } from '@/lib/demo';
export function DemoDashboardIntro(){
  const [name,setName]=useState('');const [outcome,setOutcome]=useState<ReturnType<typeof getOutcome>|null>(null);
  useEffect(()=>{const a=readAccount();const d=readDiagnostic();setName(a?.name.split(' ')[0]??'');if(d?.completedAt)setOutcome(getOutcome(d));},[]);
  const weakest=outcome?[...outcome].sort((a,b)=>a.percent-b.percent)[0]:null;
  return <section aria-label="Tu diagnóstico inicial" className="mb-5 rounded-[20px] border border-orange-300/50 bg-[var(--primary-soft)] p-5 sm:p-6"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div className="max-w-2xl"><span className="mb-2 inline-flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.12em] text-[var(--primary)]"><Sparkles size={14}/> TU PUNTO DE PARTIDA</span><h2 className="text-lg font-extrabold sm:text-xl">{name?`¡Bienvenido, ${name}!`:'¡Bienvenido a tu espacio de muestra!'}</h2><p className="mt-2 text-xs leading-5 text-[var(--muted)]">{weakest?`En las preguntas iniciales, ${weakest.name} tiene ${weakest.correct} de 3 aciertos. Puedes comenzar por ese eje y afinar tus resultados con más práctica.`:'Tu diagnóstico aparecerá aquí cuando completes la primera experiencia.'}</p><p className="mt-2 text-[11px] font-bold text-[var(--muted)]">Este dashboard conserva métricas históricas ilustrativas (ensayos, racha, XP y puntaje), todavía no vinculadas a tu diagnóstico.</p></div><div className="flex shrink-0 flex-wrap gap-2"><Link href="/estadisticas" className="soft-button inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[11px] font-extrabold"><ChartNoAxesCombined size={16}/> Mis datos</Link><Link href="/aprender" className="tactile-primary inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[11px] font-extrabold">Ir a Aprender <ArrowRight size={16}/></Link></div></div></section>;
}
