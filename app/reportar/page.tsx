"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { submitReport } from "./actions";

const questions = [
  ["screen", "¿En qué pantalla ocurrió?", 160],
  ["steps", "¿Qué pasos seguiste?", 2000],
  ["expected", "¿Qué esperabas que pasara?", 2000],
  ["observed", "¿Qué ocurrió?", 2000],
  ["device", "Dispositivo y navegador", 200],
] as const;
const fieldClass = "mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3";

export default function ReportPage() {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    const data = new FormData(event.currentTarget);
    const file = data.get("screenshot");
    if (file instanceof File && file.size > 524288) {
      setError("Usa una captura de hasta 512 KB.");
      return;
    }
    setSending(true);
    setError("");
    try {
      const result = await submitReport(data);
      if (result.success) setSent(true);
      else setError(result.error ?? "Vuelve a intentarlo.");
    } catch {
      setError("Comprueba tu conexión y vuelve a intentarlo.");
    } finally {
      setSending(false);
    }
  }
  return <main className="mx-auto max-w-xl px-5 py-10">
    <Link href="/" className="underline">Volver a PAESSED</Link>
    <h1 className="mt-6 text-3xl font-extrabold">Reportar un problema</h1>
    {sent ? <p className="mt-5" role="status">Recibimos tu reporte. Gracias por ayudarnos a mejorar.</p> :
      <form onSubmit={send} className="mt-6 grid gap-[var(--ui-space-cards,20px)]">
        {questions.map(([name, label, limit]) => <label key={name}>{label}
          {limit === 2000 ? <textarea name={name} required maxLength={limit} rows={3} className={fieldClass} /> :
            <input name={name} required maxLength={limit} className={fieldClass} />}
        </label>)}
        <label>Contacto para responderte (opcional)<input name="contact" maxLength={254} className={fieldClass} /></label>
        <label>Captura de pantalla (opcional, PNG o JPEG de hasta 512 KB)
          <input name="screenshot" type="file" accept="image/png,image/jpeg" className={fieldClass} />
        </label>
        {error && <p role="alert">{error}</p>}
        <button disabled={sending} className="tactile-primary rounded-xl p-3">{sending ? "Enviando…" : "Enviar reporte"}</button>
      </form>}
  </main>;
}
