"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, BarChart3, BookOpen, Check, ShieldCheck, Sparkles, Target, Trophy, Zap } from "lucide-react";

const steps = [
  { icon: Zap, title: "Haz un diagnóstico corto", text: "12 preguntas para detectar dónde estás fuerte y qué te conviene reforzar primero." },
  { icon: Target, title: "Recibe una ruta adaptativa", text: "PAESSED ordena práctica, contenidos y ensayos según tu evidencia real." },
  { icon: Trophy, title: "Mide progreso de verdad", text: "Tus ensayos recalibran el perfil y muestran si realmente estás acercándote a tu meta." },
];

export function Landing() {
  return (
    <div className="min-h-screen overflow-hidden bg-[var(--canvas)]">
      <header className="mx-auto flex h-20 w-full max-w-[1280px] items-center px-5 sm:px-7">
        <img src="/paessed-logo.svg" alt="PAESSED" className="h-auto w-[154px] dark:hidden" />
        <img src="/paessed-logo-dark.svg" alt="PAESSED" className="hidden h-auto w-[154px] dark:block" />
        <div className="ml-auto flex items-center gap-2">
          <Link href="/login" className="hidden rounded-xl px-4 py-2.5 text-sm font-extrabold text-[var(--muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)] sm:block">Ya tengo cuenta</Link>
          <Link href="/diagnostico" className="tactile-primary rounded-xl px-4 py-2.5 text-sm font-extrabold">Empezar gratis</Link>
        </div>
      </header>

      <main>
        <section className="relative mx-auto grid min-h-[650px] w-full max-w-[1280px] items-center gap-10 px-5 py-14 sm:px-7 lg:grid-cols-[1.05fr_.95fr] lg:py-20">
          <div className="relative z-10">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-5 inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-[11px] font-extrabold tracking-[.03em] text-orange-700 dark:border-orange-900/60 dark:bg-orange-950/30 dark:text-orange-300">
              <Sparkles size={14} />
              PREPARACIÓN PAES M1 ADAPTATIVA
            </motion.div>
            <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .06 }} className="max-w-3xl text-[44px] font-extrabold leading-[1.03] tracking-[-.045em] text-[var(--text)] sm:text-[58px] lg:text-[70px]">
              Estudia lo que más mueve tu <span className="text-[var(--primary)]">puntaje.</span>
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .12 }} className="mt-6 max-w-2xl text-base font-medium leading-7 text-[var(--muted)] sm:text-lg">
              Diagnóstico, práctica adaptativa, ensayos y análisis de debilidades en una sola experiencia. Empieza sin crear una cuenta.
            </motion.p>

            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .18 }} className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/diagnostico" className="tactile-primary inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-4 text-sm font-extrabold">
                Comenzar diagnóstico <ArrowRight size={18} />
              </Link>
              <a href="#como-funciona" className="soft-button inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-4 text-sm font-extrabold">Ver cómo funciona</a>
            </motion.div>

            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs font-bold text-[var(--muted)]">
              {["12 preguntas", "Sin registro", "Gratis", "Resultado inmediato"].map((item) => (
                <span key={item} className="flex items-center gap-1.5"><Check size={14} className="text-emerald-500" />{item}</span>
              ))}
            </div>
          </div>

          <motion.div initial={{ opacity: 0, scale: .97, y: 18 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ delay: .12, duration: .5 }} className="relative">
            <div className="absolute -inset-16 -z-10 rounded-full bg-[radial-gradient(circle,rgba(249,115,22,.18),transparent_66%)] blur-2xl" />
            <div className="surface-raised rounded-[28px] p-4 sm:p-5">
              <div className="rounded-[22px] border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-extrabold uppercase tracking-[.12em] text-[var(--muted)]">Tu foco de hoy</div>
                    <div className="mt-1 text-xl font-extrabold">Geometría · Teorema de Tales</div>
                  </div>
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-red-50 text-red-500 dark:bg-red-950/30"><Target size={21} /></div>
                </div>

                <div className="mt-5 rounded-2xl bg-[var(--surface-2)] p-4">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <div className="text-[11px] font-bold text-[var(--muted)]">Dominio actual</div>
                      <div className="mt-1 text-3xl font-extrabold text-red-500">38%</div>
                    </div>
                    <div className="rounded-full bg-red-50 px-3 py-1.5 text-[10px] font-extrabold text-red-600 dark:bg-red-950/30 dark:text-red-300">CRÍTICO</div>
                  </div>
                  <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-[var(--surface-4)]"><div className="h-full w-[38%] rounded-full bg-red-500" /></div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-[var(--border)] p-4">
                    <BookOpen size={18} className="text-indigo-500" />
                    <div className="mt-3 text-sm font-extrabold">Misión diaria</div>
                    <div className="mt-1 text-xs leading-5 text-[var(--muted)]">8 preguntas · 12 min</div>
                  </div>
                  <div className="rounded-2xl border border-[var(--border)] p-4">
                    <BarChart3 size={18} className="text-emerald-500" />
                    <div className="mt-3 text-sm font-extrabold">Último ensayo</div>
                    <div className="mt-1 text-xs leading-5 text-[var(--muted)]">742 pts · +14</div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        <section id="como-funciona" className="border-y border-[var(--border)] bg-[var(--surface)]">
          <div className="mx-auto w-full max-w-[1280px] px-5 py-20 sm:px-7">
            <div className="mx-auto max-w-2xl text-center">
              <div className="text-[11px] font-extrabold uppercase tracking-[.14em] text-[var(--primary)]">Cómo funciona</div>
              <h2 className="mt-3 text-3xl font-extrabold tracking-[-.03em] sm:text-4xl">Menos estudiar a ciegas. Más evidencia.</h2>
              <p className="mt-4 text-sm leading-6 text-[var(--muted)]">PAESSED usa tus respuestas para decidir qué mostrarte después, sin esconder la evidencia detrás de un puntaje inventado.</p>
            </div>

            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {steps.map(({ icon: Icon, title, text }, index) => (
                <div key={title} className="surface rounded-2xl p-5 sm:p-6">
                  <div className="flex items-center justify-between">
                    <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)]"><Icon size={20} /></div>
                    <div className="text-xs font-extrabold text-[var(--muted-2)]">0{index + 1}</div>
                  </div>
                  <h3 className="mt-5 text-lg font-extrabold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-[1280px] px-5 py-20 sm:px-7">
          <div className="overflow-hidden rounded-[28px] bg-slate-950 px-6 py-10 text-white sm:px-10 lg:flex lg:items-center lg:justify-between lg:px-12">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 text-xs font-extrabold text-orange-300"><ShieldCheck size={16} />SIN TARJETA · SIN REGISTRO INICIAL</div>
              <h2 className="mt-4 text-3xl font-extrabold tracking-[-.03em]">Primero descubre qué necesitas. Después decides si guardarlo.</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">Termina el diagnóstico y recién ahí crea tu cuenta para guardar el perfil, tu ruta y tus futuros ensayos.</p>
            </div>
            <Link href="/diagnostico" className="mt-7 inline-flex shrink-0 items-center gap-2 rounded-2xl bg-orange-500 px-6 py-4 text-sm font-extrabold shadow-[0_4px_0_#c2410c] transition-transform hover:-translate-y-0.5 active:translate-y-1 lg:mt-0">
              Empezar ahora <ArrowRight size={18} />
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
