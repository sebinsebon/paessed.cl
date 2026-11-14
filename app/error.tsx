"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="mx-auto flex min-h-[70dvh] max-w-lg flex-col items-start justify-center gap-5 px-6">
    <p className="text-xs font-extrabold tracking-widest text-[var(--primary)]">PAESSED</p>
    <h1 className="text-3xl font-extrabold">No pudimos comprobar tu acceso</h1>
    <p className="text-[var(--muted)]">Tu diagnóstico y tus respuestas siguen guardados en este dispositivo. Reintenta cuando vuelva la conexión.</p>
    <button onClick={reset} className="tactile-primary rounded-xl px-5 py-3 font-bold">Reintentar</button>
    <a href="/diagnostico" className="font-bold text-[var(--primary)]">Volver al diagnóstico</a>
  </main>;
}
