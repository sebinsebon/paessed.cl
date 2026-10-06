"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, LockKeyhole, Sparkles, Target, Trophy, UserRound } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

type Question = {
  domain: "Números" | "Álgebra y Funciones" | "Geometría" | "Probabilidad y Estadística";
  prompt: string;
  options: string[];
  answer: number;
};

const QUESTIONS: Question[] = [
  { domain: "Números", prompt: "¿Cuál es el 25% de 240?", options: ["40", "50", "60", "80"], answer: 2 },
  { domain: "Álgebra y Funciones", prompt: "Si 2x + 3 = 11, ¿cuál es el valor de x?", options: ["3", "4", "5", "7"], answer: 1 },
  { domain: "Geometría", prompt: "Un triángulo rectángulo tiene catetos 6 y 8. ¿Cuánto mide la hipotenusa?", options: ["10", "12", "14", "16"], answer: 0 },
  { domain: "Probabilidad y Estadística", prompt: "La media de 4, 6, 8 y 10 es:", options: ["6", "7", "8", "9"], answer: 1 },
  { domain: "Números", prompt: "¿Cuál es el valor de 2³ · 2²?", options: ["16", "24", "32", "64"], answer: 2 },
  { domain: "Álgebra y Funciones", prompt: "Para f(x) = 3x - 2, ¿cuánto vale f(4)?", options: ["8", "10", "12", "14"], answer: 1 },
  { domain: "Geometría", prompt: "Si dos triángulos son semejantes y la razón de semejanza es 2, una longitud de 5 pasa a medir:", options: ["2,5", "7", "10", "25"], answer: 2 },
  { domain: "Probabilidad y Estadística", prompt: "Al lanzar un dado justo, la probabilidad de obtener un número par es:", options: ["1/6", "1/3", "1/2", "2/3"], answer: 2 },
  { domain: "Números", prompt: "¿Cuál expresión es equivalente a √50?", options: ["5√2", "10√5", "25√2", "2√5"], answer: 0 },
  { domain: "Álgebra y Funciones", prompt: "La pendiente de una recta que pasa por (0, 2) y (3, 8) es:", options: ["1", "2", "3", "6"], answer: 1 },
  { domain: "Geometría", prompt: "El área de un círculo de radio 3 es:", options: ["3π", "6π", "9π", "18π"], answer: 2 },
  { domain: "Probabilidad y Estadística", prompt: "En 20 datos, un valor aparece 5 veces. Su frecuencia relativa es:", options: ["5%", "20%", "25%", "40%"], answer: 2 },
];

const DOMAIN_COLORS: Record<Question["domain"], string> = {
  "Números": "#10b981",
  "Álgebra y Funciones": "#6366f1",
  "Geometría": "#ef4444",
  "Probabilidad y Estadística": "#eab308",
};

function BrandHeader() {
  return (
    <header className="flex h-20 items-center border-b border-[var(--border)] bg-[var(--surface)] px-5 sm:px-7">
      <Link href="/" className="flex items-center gap-3">
        <img src="/paessed-logo.svg" alt="PAESSED" className="h-auto w-[145px] dark:hidden" />
        <img src="/paessed-logo-dark.svg" alt="PAESSED" className="hidden h-auto w-[145px] dark:block" />
      </Link>
      <Link href="/" className="ml-auto inline-flex items-center gap-2 text-xs font-extrabold text-[var(--muted)] hover:text-[var(--text)]">
        <ArrowLeft size={15} />
        Salir
      </Link>
    </header>
  );
}

export function DiagnosticFlow() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Array<number | null>>(() => Array(QUESTIONS.length).fill(null));

  const question = QUESTIONS[index];
  const selected = answers[index];
  const progress = ((index + 1) / QUESTIONS.length) * 100;

  const next = () => {
    if (selected === null) return;
    if (index < QUESTIONS.length - 1) {
      setIndex(index + 1);
      return;
    }

    const correct = answers.reduce((sum, value, i) => sum + (value === QUESTIONS[i].answer ? 1 : 0), 0);
    const byDomain = Object.keys(DOMAIN_COLORS).map((domain) => {
      const positions = QUESTIONS.map((q, i) => ({ q, i })).filter(({ q }) => q.domain === domain);
      const hits = positions.reduce((sum, item) => sum + (answers[item.i] === item.q.answer ? 1 : 0), 0);
      return { domain, correct: hits, total: positions.length, pct: Math.round((hits / positions.length) * 100) };
    });
    const weakest = [...byDomain].sort((a, b) => a.pct - b.pct)[0];

    localStorage.setItem("paessed-diagnostic", JSON.stringify({
      correct,
      total: QUESTIONS.length,
      byDomain,
      weakest: weakest.domain,
      completedAt: new Date().toISOString(),
    }));
    router.push("/diagnostico/resultado");
  };

  const choose = (option: number) => {
    const copy = [...answers];
    copy[index] = option;
    setAnswers(copy);
  };

  return (
    <div className="min-h-screen bg-[var(--canvas)]">
      <BrandHeader />
      <div className="h-1.5 bg-[var(--surface-3)]">
        <div className="h-full rounded-r-full bg-[var(--primary)] transition-all duration-300" style={{ width: progress + "%" }} />
      </div>

      <main className="mx-auto grid w-full max-w-[1120px] gap-7 px-5 py-8 sm:px-7 lg:grid-cols-[minmax(0,1fr)_300px] lg:py-12">
        <section>
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-[.12em] text-[var(--muted)]">
                Diagnóstico inicial · {index + 1}/{QUESTIONS.length}
              </div>
              <h1 className="mt-1 text-2xl font-extrabold tracking-[-.02em]">Responde sin apurarte</h1>
            </div>
            <div className="rounded-full bg-[var(--surface-2)] px-3 py-1.5 text-[10px] font-extrabold text-[var(--muted)]">~8 min</div>
          </div>

          <div className="surface-raised rounded-[24px] p-5 sm:p-7">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-extrabold"
              style={{ color: DOMAIN_COLORS[question.domain], borderColor: DOMAIN_COLORS[question.domain] + "55", background: DOMAIN_COLORS[question.domain] + "12" }}>
              <span className="h-2 w-2 rounded-full" style={{ background: DOMAIN_COLORS[question.domain] }} />
              {question.domain}
            </div>

            <div className="text-lg font-bold leading-8 sm:text-xl">{question.prompt}</div>

            <div className="mt-7 space-y-3">
              {question.options.map((option, optionIndex) => {
                const active = selected === optionIndex;
                const klass = "flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-all " +
                  (active
                    ? "border-orange-400 bg-orange-50 shadow-[0_3px_0_#fb923c] dark:bg-orange-950/20"
                    : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)]");
                return (
                  <button key={option} onClick={() => choose(optionIndex)} className={klass}>
                    <span className={"grid h-8 w-8 shrink-0 place-items-center rounded-xl text-xs font-extrabold " + (active ? "bg-[var(--primary)] text-white" : "bg-[var(--surface-3)] text-[var(--muted)]")}>
                      {String.fromCharCode(65 + optionIndex)}
                    </span>
                    <span className="font-bold">{option}</span>
                    {active && <Check size={18} className="ml-auto text-[var(--primary)]" />}
                  </button>
                );
              })}
            </div>

            <div className="mt-7 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setIndex(Math.max(0, index - 1))}
                disabled={index === 0}
                className="soft-button rounded-xl px-4 py-3 text-xs font-extrabold disabled:cursor-not-allowed disabled:opacity-40"
              >
                Atrás
              </button>
              <button
                type="button"
                onClick={next}
                disabled={selected === null}
                className="tactile-primary inline-flex items-center gap-2 rounded-xl px-5 py-3 text-xs font-extrabold disabled:cursor-not-allowed disabled:opacity-45"
              >
                {index === QUESTIONS.length - 1 ? "Ver mi diagnóstico" : "Siguiente"}
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="surface rounded-2xl p-5">
            <div className="flex items-center gap-2 text-sm font-extrabold"><Target size={18} className="text-[var(--primary)]" />Qué estamos midiendo</div>
            <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
              No buscamos un puntaje PAES exacto. Buscamos suficiente evidencia para ordenar tu primera ruta de estudio.
            </p>
          </div>
          <div className="surface rounded-2xl p-5">
            <div className="text-[10px] font-extrabold uppercase tracking-[.12em] text-[var(--muted)]">Cobertura</div>
            <div className="mt-4 space-y-3">
              {Object.entries(DOMAIN_COLORS).map(([domain, color]) => (
                <div key={domain} className="flex items-center gap-2 text-xs font-bold text-[var(--muted)]">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                  {domain}
                  <span className="ml-auto">3</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}

type DiagnosticData = {
  correct: number;
  total: number;
  weakest: string;
  byDomain: Array<{ domain: string; correct: number; total: number; pct: number }>;
};

export function DiagnosticResult() {
  const [data, setData] = useState<DiagnosticData | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("paessed-diagnostic");
    if (raw) {
      setData(JSON.parse(raw));
      return;
    }
    setData({
      correct: 8,
      total: 12,
      weakest: "Geometría",
      byDomain: [
        { domain: "Números", correct: 3, total: 3, pct: 100 },
        { domain: "Álgebra y Funciones", correct: 2, total: 3, pct: 67 },
        { domain: "Geometría", correct: 1, total: 3, pct: 33 },
        { domain: "Probabilidad y Estadística", correct: 2, total: 3, pct: 67 },
      ],
    });
  }, []);

  if (!data) return null;

  return (
    <div className="min-h-screen bg-[var(--canvas)]">
      <BrandHeader />
      <main className="mx-auto w-full max-w-[980px] px-5 py-10 sm:px-7 sm:py-14">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-500 dark:bg-emerald-950/30"><Sparkles size={25} /></div>
          <div className="mt-5 text-[11px] font-extrabold uppercase tracking-[.14em] text-[var(--primary)]">Diagnóstico completado</div>
          <h1 className="mt-2 text-3xl font-extrabold tracking-[-.03em] sm:text-4xl">Ya tenemos un primer mapa de tu M1</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Esto no es un puntaje PAES. Es una señal inicial para decidir qué practicar primero.</p>
        </div>

        <div className="mt-9 grid gap-4 lg:grid-cols-[.72fr_1.28fr]">
          <div className="surface-raised rounded-2xl p-6">
            <div className="text-[10px] font-extrabold uppercase tracking-[.12em] text-[var(--muted)]">Resultado inicial</div>
            <div className="mt-3 flex items-end gap-2">
              <span className="text-5xl font-extrabold tracking-[-.04em]">{data.correct}</span>
              <span className="pb-1 text-lg font-bold text-[var(--muted)]">/ {data.total}</span>
            </div>
            <div className="mt-5 rounded-2xl bg-red-50 p-4 dark:bg-red-950/20">
              <div className="text-[10px] font-extrabold uppercase tracking-[.1em] text-red-500">Prioridad inicial</div>
              <div className="mt-1 text-lg font-extrabold">{data.weakest}</div>
              <div className="mt-1 text-xs leading-5 text-[var(--muted)]">Tu primera misión adaptativa partirá reforzando este eje.</div>
            </div>
          </div>

          <div className="surface rounded-2xl p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-[.12em] text-[var(--muted)]">Tu dominio por eje</div>
                <div className="mt-1 text-lg font-extrabold">Primera evidencia</div>
              </div>
              <Trophy size={22} className="text-amber-500" />
            </div>
            <div className="mt-5 space-y-4">
              {data.byDomain.map((item) => (
                <div key={item.domain}>
                  <div className="mb-2 flex items-center justify-between gap-3 text-xs font-bold">
                    <span>{item.domain}</span>
                    <span className="text-[var(--muted)]">{item.correct}/{item.total}</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-[var(--surface-3)]">
                    <div className="h-full rounded-full" style={{ width: item.pct + "%", background: item.pct < 50 ? "#ef4444" : item.pct < 80 ? "#eab308" : "#10b981" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl bg-slate-950 p-6 text-white sm:flex sm:items-center sm:justify-between sm:gap-6">
          <div>
            <div className="text-lg font-extrabold">Guarda este diagnóstico y empieza tu ruta</div>
            <div className="mt-1 text-xs leading-5 text-slate-300">Crea tu cuenta recién ahora. El diagnóstico ya está hecho.</div>
          </div>
          <Link href="/registro" className="mt-4 inline-flex shrink-0 items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-xs font-extrabold shadow-[0_3px_0_#c2410c] sm:mt-0">
            Guardar mi progreso <ArrowRight size={16} />
          </Link>
        </div>
      </main>
    </div>
  );
}

export function RegisterGate() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const canSubmit = useMemo(() => name.trim().length >= 2 && email.includes("@"), [name, email]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    localStorage.setItem("paessed-user", JSON.stringify({ name: name.trim(), email: email.trim() }));
    router.push("/app/inicio");
  };

  return (
    <div className="min-h-screen bg-[var(--canvas)]">
      <BrandHeader />
      <main className="mx-auto grid min-h-[calc(100vh-80px)] w-full max-w-[1050px] items-center gap-8 px-5 py-10 sm:px-7 lg:grid-cols-[.85fr_1.15fr]">
        <section className="hidden lg:block">
          <div className="inline-flex items-center gap-2 rounded-full bg-[var(--primary-soft)] px-3 py-1.5 text-[10px] font-extrabold text-[var(--primary)]">
            <Sparkles size={14} />TU RUTA ESTÁ LISTA
          </div>
          <h1 className="mt-5 text-4xl font-extrabold leading-[1.08] tracking-[-.04em]">Guarda tu progreso y continúa donde quedaste.</h1>
          <div className="mt-7 space-y-4">
            {[
              "Conserva tu diagnóstico y tus próximos ensayos.",
              "Recibe misiones según tus debilidades reales.",
              "Sigue tu dominio por eje y unidad.",
            ].map((item) => (
              <div key={item} className="flex items-start gap-3 text-sm font-bold text-[var(--muted)]">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-500 dark:bg-emerald-950/30"><Check size={14} /></span>
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="surface-raised rounded-[26px] p-5 sm:p-8">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--secondary-soft)] text-[var(--secondary)]"><UserRound size={22} /></div>
          <h2 className="mt-5 text-2xl font-extrabold tracking-[-.02em]">Crea tu cuenta</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Solo te la pedimos después del diagnóstico para no frenarte antes de probar PAESSED.</p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block">
              <span className="text-xs font-extrabold">Nombre</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seba" className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm outline-none transition focus:border-orange-400" />
            </label>
            <label className="block">
              <span className="text-xs font-extrabold">Correo</span>
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="tu@correo.cl" className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm outline-none transition focus:border-orange-400" />
            </label>
            <label className="block">
              <span className="text-xs font-extrabold">Contraseña</span>
              <input type="password" placeholder="8 caracteres o más" className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm outline-none transition focus:border-orange-400" />
            </label>

            <button disabled={!canSubmit} className="tactile-primary mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-extrabold disabled:cursor-not-allowed disabled:opacity-45">
              Crear cuenta y continuar <ArrowRight size={17} />
            </button>
          </form>

          <div className="mt-5 flex items-start gap-2 rounded-xl bg-[var(--surface-2)] p-3 text-[10px] leading-4 text-[var(--muted)]">
            <LockKeyhole size={14} className="mt-0.5 shrink-0" />
            En este prototipo la sesión se simula localmente; el flujo queda preparado para conectar autenticación real después.
          </div>
        </section>
      </main>
    </div>
  );
}
