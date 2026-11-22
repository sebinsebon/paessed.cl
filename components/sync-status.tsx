"use client";

import { Activity, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { AppProgressLoading } from "./page-skeletons";
import loadingStyles from "./loading-state.module.css";
import { getSyncOwner, openLocalDatabase } from "@/lib/sync/local";
import { declineGuestImport, ensureSyncBootstrap, getSyncIdentity, getSyncStatus, guestProgressSummary, importGuestProgress, initializeSyncIdentity, listSyncConflicts, matchesBrowserSession, resolveSyncConflict, startSync, subscribeSyncIdentity, subscribeSyncStatus, synchronize, watchSyncIdentity, type SyncStatusValue } from "@/lib/sync/client";
import { ProgressDialog, type ProgressChoice } from "./progress-dialog";
import { Modal } from "./modal";
import { Dashboard } from "./dashboard";
import { useSyncIdentity } from "./use-sync-identity";

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
  const epoch = getSyncIdentity().epoch;
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
  const identity = getSyncIdentity();
  if (identity.status !== "verified" || identity.epoch !== epoch) return;
  const url = URL.createObjectURL(blob), link = document.createElement("a");
  link.href = url; link.download = `PAESSED-${label}.${extension}`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function SyncStatus({ children }: { children?: ReactNode }) {
  const pathname = usePathname();
  const identity = useSyncIdentity();
  const reduceMotion = useReducedMotion();
  const [ready, setReady] = useState(false), [status, setStatus] = useState<SyncStatusValue>(getSyncStatus);
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof guestProgressSummary>> | null>(null);
  const [scope, setScope] = useState<string | null>(null);
  const [preparedEpoch, setPreparedEpoch] = useState(-1);
  const [conflicts, setConflicts] = useState<Awaited<ReturnType<typeof listSyncConflicts>>>([]);
  const [archived, setArchived] = useState<Awaited<ReturnType<typeof listSyncConflicts>>>([]);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [deferred, setDeferred] = useState(false);
  const [dismissedError, setDismissedError] = useState("");
  const [archiveOpen, setArchiveOpen] = useState(false);
  const refreshing = useRef(0);
  useEffect(() => {
    let active = true, initialized = false, preparingEpoch = -1, stop = () => {};
    const stopWatching = watchSyncIdentity();
    const scopeChanged = () => {
      const current = getSyncIdentity();
      if (!active || !initialized || current.status !== "verified" || current.epoch === preparingEpoch) return;
      setReady(false);
      setBusy(false);
      setSummary(null);
      setConflicts([]);
      setArchived([]);
      setDeferred(false);
      setArchiveOpen(false);
      setError("");
      setDismissedError("");
      void prepare();
    };
    const stopIdentity = subscribeSyncIdentity(scopeChanged);
    const refreshConflicts = async () => {
      const revision = ++refreshing.current, owner = getSyncOwner(), epoch = getSyncIdentity().epoch;
      const items = await listSyncConflicts(true);
      if (active && revision === refreshing.current && epoch === getSyncIdentity().epoch && owner === getSyncOwner()) { setConflicts(items.filter(item => !item.resolved)); setArchived(items.filter(item => item.resolved)); }
    };
    const unsubscribe = subscribeSyncStatus(() => { if (active) { setStatus(getSyncStatus()); void refreshConflicts().catch(err => { if (active) setError(err.message); }); } });
    async function prepare() {
      const verified = getSyncIdentity();
      if (!active || verified.status !== "verified") return;
      const { epoch, owner } = verified;
      preparingEpoch = epoch;
      const current = () => active && epoch === getSyncIdentity().epoch && owner === getSyncOwner() && matchesBrowserSession();
      try { await ensureSyncBootstrap(verified); }
      catch (err) { if (current()) setError(err instanceof Error ? err.message : "No se pudo sincronizar tu progreso."); }
      if (!current()) return;
      setScope(owner);
      stop();
      stop = startSync();
      try {
        if (!owner) return;
        const db = await openLocalDatabase(owner);
        const imported = await new Promise<boolean>((resolve, reject) => { const tx = db.transaction("meta", "readonly"), request = tx.objectStore("meta").get("guest-import-confirmed"); tx.oncomplete = () => resolve(!!request.result); tx.onerror = () => reject(tx.error); });
        if (!imported) {
          const value = await guestProgressSummary();
          if (current() && (value.attempts || value.sessions || value.completedNodes || value.savedQuestions || value.learning)) setSummary(value);
        }
        if (current()) await refreshConflicts();
      } catch (err) {
        if (current()) setError(err instanceof Error ? err.message : "No se pudo leer tu progreso.");
      } finally {
        if (current()) { setPreparedEpoch(epoch); setReady(true); }
      }
    }
    void initializeSyncIdentity(true)
      .catch(err => { if (active) setError(err instanceof Error ? err.message : "No se pudo comprobar la cuenta."); })
      .then(() => { initialized = true; return prepare(); });
    return () => { active = false; stop(); unsubscribe(); stopIdentity(); stopWatching(); };
  }, []);
  const prepared = ready && identity.epoch === preparedEpoch && scope === getSyncOwner();
  const visible = prepared && identity.status === "verified" && identity.owner === scope;
  // A routine focus check can resume the same workspace. A changed epoch
  // removes the former workspace altogether, including its hidden DOM.
  const workspace = prepared && <Activity key={preparedEpoch} mode={visible ? "visible" : "hidden"}>{children}</Activity>;
  const waiting = <>
      {identity.status === "unavailable" && <div role="alert" className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-2 text-sm">
        <p>{status.message}</p>
        <button type="button" className="soft-button min-h-11 rounded-lg px-3" onClick={() => void initializeSyncIdentity()}>Reintentar sesión</button>
        <Link href="/login">Iniciar sesión</Link>
      </div>}
      {pathname === "/app/inicio" ? <Dashboard learningLoading learningError="" state={null} profile={null} neutral /> :
        <AppProgressLoading key={pathname} pathname={pathname} />}
    </>;
  const conflict = !deferred ? conflicts[0] : undefined;
  const importPrompt = !deferred && !conflict && summary;
  const issue = error || (["error", "paused"].includes(status.state) ? status.message : "");
  const showError = !conflict && !importPrompt && !!issue && dismissedError !== issue;
  const pending = !!conflict || !!importPrompt || showError || archiveOpen;
  const sameScope = () => {
    const current = getSyncIdentity();
    return current.epoch === preparedEpoch && getSyncOwner() === scope;
  };
  async function updateConflicts(operation: () => Promise<void>, failure: string) {
    if (getSyncIdentity().status !== "verified" || !sameScope()) return;
    setBusy(true);
    setError("");
    try {
      await operation();
      if (!sameScope()) return;
      const all = await listSyncConflicts(true);
      if (!sameScope()) return;
      setConflicts(all.filter(item => !item.resolved));
      setArchived(all.filter(item => item.resolved));
    } catch (err) {
      if (sameScope()) setError(err instanceof Error ? err.message : failure);
    } finally {
      if (sameScope()) setBusy(false);
    }
  }
  async function chooseImport(choice: ProgressChoice) {
    if (choice === "later") { setDeferred(true); return; }
    await updateConflicts(async () => {
      if (choice === "save") await importGuestProgress();
      else await declineGuestImport();
      if (sameScope()) setSummary(null);
    }, choice === "save" ? "No se pudo incorporar el progreso." : "No se pudo guardar tu elección.");
  }
  return <>
    {visible && showError && <section aria-label="Estado de sincronización" className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 px-4 py-2 text-sm">
      <p role="status" className="min-w-0 flex-1 basis-64 text-[var(--muted)]">{issue}</p>
      <button type="button" className="soft-button min-h-11 rounded-lg px-3" onClick={() => { setError(""); void synchronize(true); }}>Reintentar</button>
      {status.state === "paused" && <Link href="/login" className="soft-button inline-flex min-h-11 items-center rounded-lg px-3">Iniciar sesión</Link>}
      <button type="button" className="min-h-11 px-3" onClick={() => setDismissedError(issue)}>Cerrar aviso</button>
    </section>}
    {workspace}
    {!visible ? waiting : <>
    {scope && status.state === "syncing" && <motion.p role="status" className={loadingStyles.syncNotice}
      initial={reduceMotion ? false : { opacity: 0.8 }} animate={{ opacity: 1 }} transition={{ duration: reduceMotion ? 0 : 0.18 }}>
      Actualizando tu progreso…
    </motion.p>}
    {conflict && <ProgressDialog key={conflict.id} title="Hay dos versiones de tu progreso" busy={busy} error={error} onDismiss={() => setDeferred(true)}
      saveExplanation="Continuarás con la versión recibida. La versión de tu cuenta se conservará como alternativa y no sumará métricas."
      discardExplanation="Seguirás con la versión de tu cuenta. La versión recibida se conservará como alternativa, sin sumarse a tus métricas."
      onChoose={async choice => {
        if (choice === "later") setDeferred(true);
        else await updateConflicts(() => resolveSyncConflict(conflict.id, choice === "save" ? "incoming" : "current"), "No se pudo resolver el conflicto.");
      }}>
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
    {archived.length > 0 && !pending && <button type="button" className="soft-button fixed bottom-20 right-6 z-20 rounded-xl px-4 py-2 text-xs" onClick={() => setArchiveOpen(true)}>Ver versiones conservadas ({archived.length})</button>}
    {archiveOpen && !conflict && !importPrompt && !showError && <Modal labelledBy="archived-title" onDismiss={() => setArchiveOpen(false)}><h2 id="archived-title" tabIndex={-1} className="text-2xl font-extrabold">Versiones conservadas</h2><p className="mt-4 text-sm text-[var(--muted)]">Estas alternativas no suman métricas. Puedes descargarlas para recuperarlas.</p>{archived.map((item,index) => <article key={item.id} className="mt-4 border-t border-[var(--border)] pt-4 text-sm"><h3 className="font-bold">Versión conservada {index+1}</h3><p className="mt-2">Cuenta: {describeVersion(item.current)}</p><p className="mt-2">Recibida: {describeVersion(item.alternative)}</p><div className="mt-3 grid gap-3"><button type="button" onClick={() => void downloadVersion(item.current,"version-cuenta").catch(err=>setError(err.message))}>Descargar versión de la cuenta</button><button type="button" onClick={() => void downloadVersion(item.alternative,"version-recibida").catch(err=>setError(err.message))}>Descargar versión recibida</button></div></article>)}<button type="button" className="soft-button mt-6 rounded-xl px-4 py-3" onClick={() => setArchiveOpen(false)}>Volver</button></Modal>}
    </>}
  </>;
}
