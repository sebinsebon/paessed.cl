"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { getSyncOwner, openLocalDatabase } from "@/lib/sync/local";
import { getSyncStatus, guestProgressSummary, importGuestProgress, initializeSyncIdentity, listSyncConflicts, resolveSyncConflict, startSync, subscribeSyncStatus, synchronize, type SyncStatusValue } from "@/lib/sync/client";
import { ProgressDialog, type ProgressChoice } from "./progress-dialog";
import { ProgressPromptContext } from "./progress-prompt-context";
import { Modal } from "./modal";

function describeVersion(value: unknown): string {
  if (!value || typeof value !== "object") return "Versión conservada para su recuperación.";
  const data = value as Record<string, unknown>;
  if (data.state) return describeVersion(data.state);
  if (data.learning) return describeVersion(data.learning);
  if (data.session) {
    const session = data.session as {answers?:Record<string,string>;completedAt?:string};
    return `${Object.keys(session.answers ?? {}).length} respuestas guardadas${session.completedAt ? ", sesión entregada" : ", sesión en curso"}.`;
  }
  if (Array.isArray(data.attempts) && Array.isArray(data.nodes)) return `${data.attempts.length} respuestas originales y ${data.nodes.filter(node => node && typeof node === "object" && node.state === "completed").length} nodos completados.`;
  if (data.type === "learning") return "Una respuesta o un avance de la ruta que no coincide con la versión de la cuenta.";
  return "Avance educativo conservado.";
}

async function downloadVersion(value: unknown, label: string) {
  const data = value && typeof value === "object" ? value as Record<string,unknown> : {};
  const learning = data.version === 1 && Array.isArray(data.attempts) ? data : data.type === "restore-learning" ? data.state : data.learning;
  let blob: Blob, extension = "json";
  if (learning) {
    const { validateLearningState } = await import("@/lib/learning/repository");
    const state = validateLearningState(learning);
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    const sessions = {}, practice: unknown[] = Array.isArray(data.practice) ? [...data.practice] : [];
    const savedSession = data.session as {state?:unknown;source_id?:string;mode?:string} | undefined;
    if (savedSession?.state && savedSession.source_id && savedSession.mode) practice.push({mode:savedSession.mode,sourceId:savedSession.source_id,session:savedSession.state});
    zip.file("manifest.json", JSON.stringify({format:"paessed-browser-backup",version:3,createdAt:new Date().toISOString(),categories:["learning"],items:[],exams:[],learning:{state,sessions,practice,savedQuestions:[]}}));
    blob = await zip.generateAsync({type:"blob",compression:"DEFLATE"}); extension = "zip";
  } else {
    // Only educational states/actions are exported, never receipt or device metadata.
    blob = new Blob([JSON.stringify({format:"paessed-educational-alternative",version:1,educational:value},null,2)],{type:"application/json"});
  }
  const url = URL.createObjectURL(blob), link = document.createElement("a");
  link.href = url; link.download = `PAESSED-${label}.${extension}`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function SyncStatus({ children }: { children?: ReactNode }) {
  const [ready, setReady] = useState(false), [status, setStatus] = useState<SyncStatusValue>(getSyncStatus);
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof guestProgressSummary>> | null>(null);
  const [scope, setScope] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<Awaited<ReturnType<typeof listSyncConflicts>>>([]);
  const [archived, setArchived] = useState<Awaited<ReturnType<typeof listSyncConflicts>>>([]);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [deferred, setDeferred] = useState(false);
  const [dismissedError, setDismissedError] = useState("");
  const [archiveOpen, setArchiveOpen] = useState(false);
  const refreshing = useRef(0);
  useEffect(() => {
    let active = true, initialized = false, stop = () => {};
    const scopeChanged = () => { if (active && initialized) { setReady(false); setScope(getSyncOwner()); setSummary(null); setConflicts([]); setArchived([]); setDeferred(false); setArchiveOpen(false); setError(""); setDismissedError(""); stop(); void prepare().catch(err => { if (active) { setError(err.message); setReady(true); } }); } };
    window.addEventListener("paessed-sync-owner-change", scopeChanged);
    const refreshConflicts = async () => {
      const revision = ++refreshing.current, owner = getSyncOwner();
      const items = await listSyncConflicts(true);
      if (active && revision === refreshing.current && owner === getSyncOwner()) { setConflicts(items.filter(item => !item.resolved)); setArchived(items.filter(item => item.resolved)); }
    };
    const unsubscribe = subscribeSyncStatus(() => { if (active) { setStatus(getSyncStatus()); void refreshConflicts().catch(err => { if (active) setError(err.message); }); } });
    async function prepare() {
      const owner = getSyncOwner();
      if (!active) return;
      setScope(owner); stop(); stop = startSync();
      if (owner) {
        const db = await openLocalDatabase(owner);
        const imported = await new Promise<boolean>((resolve, reject) => { const tx = db.transaction("meta", "readonly"), request = tx.objectStore("meta").get("guest-import-confirmed"); tx.oncomplete = () => resolve(!!request.result); tx.onerror = () => reject(tx.error); });
        if (!imported) { const value = await guestProgressSummary(); if (active && owner === getSyncOwner() && (value.attempts || value.sessions || value.completedNodes || value.savedQuestions || value.learning)) setSummary(value); }
        if (active && owner === getSyncOwner()) await refreshConflicts();
      }
      if (active && owner === getSyncOwner()) setReady(true);
    }
    void initializeSyncIdentity().then(() => { initialized = true; return prepare(); }).catch(err => { if (active) { setError(err.message); setReady(true); } });
    return () => { active = false; stop(); unsubscribe(); window.removeEventListener("paessed-sync-owner-change", scopeChanged); };
  }, []);
  const incorporate = async () => { setBusy(true); setError(""); try { await importGuestProgress(); setSummary(null); const all = await listSyncConflicts(true); setConflicts(all.filter(item=>!item.resolved)); setArchived(all.filter(item=>item.resolved)); } catch (err) { setError(err instanceof Error ? err.message : "No se pudo incorporar el progreso."); } finally { setBusy(false); } };
  const resolve = async (id: string, choice: "incoming" | "current") => { setBusy(true); setError(""); try { await resolveSyncConflict(id, choice); const all = await listSyncConflicts(true); setConflicts(all.filter(item=>!item.resolved)); setArchived(all.filter(item=>item.resolved)); } catch (err) { setError(err instanceof Error ? err.message : "No se pudo resolver el conflicto."); } finally { setBusy(false); } };
  if (!ready) return <div className="p-6 text-sm text-[var(--muted)]" role="status">Cargando tu progreso…</div>;
  const conflict = !deferred ? conflicts[0] : undefined;
  const importPrompt = !deferred && !conflict && summary;
  const issue = error || (["error", "paused"].includes(status.state) ? status.message : "");
  const showError = !conflict && !importPrompt && !!issue && dismissedError !== issue;
  const pending = !!conflict || !!importPrompt || showError || archiveOpen;
  async function chooseImport(choice: ProgressChoice) {
    if (choice === "later") { setDeferred(true); return; }
    if (choice === "save") { await incorporate(); return; }
    setBusy(true); setError("");
    try {
      const owner = getSyncOwner(); if (!owner || owner !== scope) throw new Error("La cuenta cambió. Vuelve a intentarlo.");
      const db = await openLocalDatabase(owner);
      await new Promise<void>((resolve, reject) => { const tx = db.transaction("meta", "readwrite"); tx.objectStore("meta").put("declined", "guest-import-confirmed"); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
      setSummary(null);
    } catch (err) { setError(err instanceof Error ? err.message : "No se pudo guardar tu elección."); }
    finally { setBusy(false); }
  }
  return <ProgressPromptContext.Provider value={pending}>
    <Fragment key={scope ?? "guest"}>{children}</Fragment>
    {conflict && <ProgressDialog key={conflict.id} title="Hay dos versiones de tu progreso" busy={busy} error={error} onDismiss={() => setDeferred(true)}
      saveExplanation="Continuarás con la versión recibida. La versión de tu cuenta se conservará como alternativa y no sumará métricas."
      discardExplanation="Seguirás con la versión de tu cuenta. La versión recibida se conservará como alternativa, sin sumarse a tus métricas."
      onChoose={async choice => { if (choice === "later") setDeferred(true); else await resolve(conflict.id, choice === "save" ? "incoming" : "current"); }}>
      <p>Revisa ambas versiones antes de elegir. Guardar usa el progreso recibido; no guardar mantiene el de tu cuenta. Conservaremos la alternativa.</p>
      <details><summary>Comparar versiones</summary><p><strong>Tu cuenta:</strong> {describeVersion(conflict.current)}</p><p><strong>Versión recibida:</strong> {describeVersion(conflict.alternative)}</p>
        <button type="button" className="text-[var(--primary)]" onClick={() => void downloadVersion(conflict.current,"version-cuenta").catch(err=>setError(err.message))}>Descargar versión de la cuenta</button><br />
        <button type="button" className="text-[var(--primary)]" onClick={() => void downloadVersion(conflict.alternative,"version-recibida").catch(err=>setError(err.message))}>Descargar versión recibida</button>
      </details>
    </ProgressDialog>}
    {importPrompt && <ProgressDialog title="Tienes progreso en este dispositivo" busy={busy} error={error} onDismiss={() => setDeferred(true)} onChoose={chooseImport}
      saveExplanation="Incorporaremos este progreso a tu cuenta. Si hay versiones incompatibles, podrás compararlas antes de elegir con cuál continuar."
      discardExplanation="Tu cuenta seguirá como está y no volveremos a ofrecer esta incorporación. El progreso original permanecerá en este navegador.">
      <p>{summary.attempts || summary.completedNodes || summary.sessions || summary.savedQuestions ? `${summary.attempts} respuestas, ${summary.completedNodes} nodos completados y ${summary.sessions} sesiones${summary.savedQuestions ? `, con ${summary.savedQuestions} preguntas guardadas` : ""}.` : "Tienes preferencias de práctica guardadas en este navegador."}</p>
      <p>Puedes guardarlo en tu cuenta. No guardar conserva tu cuenta como está; más tarde te permite decidir al volver.</p>
    </ProgressDialog>}
    {showError && <Modal labelledBy="sync-issue-title" onDismiss={() => setDismissedError(issue)}>
      <h2 id="sync-issue-title" tabIndex={-1} className="text-2xl font-extrabold">Tu progreso sigue guardado</h2>
      <p role="alert" className="mt-4 text-sm leading-7 text-[var(--muted)]">{issue}</p>
      <div className="mt-6 flex flex-wrap gap-4"><button type="button" className="soft-button rounded-xl px-4 py-3" onClick={() => { setDismissedError(issue); setError(""); void synchronize(); }}>Reintentar</button>{status.state === "paused" && <Link href="/login" className="soft-button rounded-xl px-4 py-3">Iniciar sesión</Link>}<button type="button" onClick={() => setDismissedError(issue)}>Más tarde</button></div>
    </Modal>}
    {archived.length > 0 && !pending && <button type="button" className="soft-button fixed bottom-20 right-6 z-20 rounded-xl px-4 py-2 text-xs" onClick={() => setArchiveOpen(true)}>Ver versiones conservadas ({archived.length})</button>}
    {archiveOpen && !conflict && !importPrompt && !showError && <Modal labelledBy="archived-title" onDismiss={() => setArchiveOpen(false)}><h2 id="archived-title" tabIndex={-1} className="text-2xl font-extrabold">Versiones conservadas</h2><p className="mt-4 text-sm text-[var(--muted)]">Estas alternativas no suman métricas. Puedes descargarlas para recuperarlas.</p>{archived.map((item,index) => <article key={item.id} className="mt-4 border-t border-[var(--border)] pt-4 text-sm"><h3 className="font-bold">Versión conservada {index+1}</h3><p className="mt-2">Cuenta: {describeVersion(item.current)}</p><p className="mt-2">Recibida: {describeVersion(item.alternative)}</p><div className="mt-3 grid gap-3"><button type="button" onClick={() => void downloadVersion(item.current,"version-cuenta").catch(err=>setError(err.message))}>Descargar versión de la cuenta</button><button type="button" onClick={() => void downloadVersion(item.alternative,"version-recibida").catch(err=>setError(err.message))}>Descargar versión recibida</button></div></article>)}<button type="button" className="soft-button mt-6 rounded-xl px-4 py-3" onClick={() => setArchiveOpen(false)}>Volver</button></Modal>}
  </ProgressPromptContext.Provider>;
}
