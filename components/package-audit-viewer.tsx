"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { PaessedBlocks } from "@/components/paessed-blocks";
import { useImportedResourceUrls } from "@/components/use-imported-resource-urls";
import { getImportedExam, type ImportedExamRecord } from "@/lib/local-imports";
import { getQuestions, getQuestionId, getOptions, isRecord, questionText } from "@/lib/imported-question-content";
import { QUESTION_PAPER_FONT } from "@/lib/question-paper";

const statusLabel = (status: unknown) => status === "verified" ? "verificada" : status === "provisional" ? "provisional" : "ausente";

/** Package inspection only. Student progress and editing APIs never enter this view. */
export function PackageAuditViewer({ id }: { id: string }) {
  const [record, setRecord] = useState<ImportedExamRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [active, setActive] = useState(0);
  const { resourceUrls, resourceError, resourceIssues, resourcesLoading } = useImportedResourceUrls(record);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setRecord(null);
    setError("");
    setActive(0);
    void getImportedExam(id).then((value) => {
      if (!cancelled) setRecord(value);
    }).catch(() => {
      if (!cancelled) setError("No se pudo leer el paquete local.");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  const questions = useMemo(() => getQuestions(record?.finalJson), [record]);
  const current = questions[active];
  const answer = isRecord(current) && isRecord(current.answer) ? current.answer : null;
  const explanation = isRecord(current) && isRecord(current.explanation) ? current.explanation : null;
  const issues = isRecord(current) && Array.isArray(current.issues) ? current.issues.filter((issue): issue is string => typeof issue === "string") : [];

  return <AppShell title="Auditoría local del paquete" eyebrow="Desarrollo local">
    <div className="space-y-5">
    <h1 className="text-2xl font-bold">Auditoría local del paquete</h1>
    <p>Solo lectura · Respuestas, explicaciones y observaciones del archivo.</p>
    {loading ? <p role="status">Cargando paquete…</p> : error ? <p role="alert">{error}</p> : !record ? <p>Paquete local no encontrado.</p> : <>
      <h2 className="text-lg font-bold">{record.summary.title}</h2>
      <nav aria-label="Preguntas del paquete" className="flex items-center gap-4">
        <button type="button" disabled={active === 0} onClick={() => setActive(active - 1)}>Anterior</button>
        <span>{questions.length ? active + 1 : 0} de {questions.length} preguntas</span>
        <button type="button" disabled={active >= questions.length - 1} onClick={() => setActive(active + 1)}>Siguiente</button>
      </nav>
      {resourceError && <p role="alert">{resourceError}</p>}
      {[...new Set(resourceIssues.values())].map((issue) => <p role="alert" key={issue}>{issue}</p>)}
      {current ? <article style={QUESTION_PAPER_FONT} className="space-y-5">
        <h3>Pregunta {getQuestionId(current, active)}</h3>
        {isRecord(current) && Array.isArray(current.stem) ? <PaessedBlocks blocks={current.stem} assetUrls={resourceUrls.byId} loadingAssets={resourcesLoading} /> : <p>{questionText(current)}</p>}
        <ul aria-label="Alternativas del archivo" className="space-y-3">
          {getOptions(current).map((option) => <li key={option.key}>
            <span>{option.key}) </span>
            {option.blocks ? <PaessedBlocks blocks={option.blocks} assetUrls={resourceUrls.byId} loadingAssets={resourcesLoading} /> : option.text}
          </li>)}
        </ul>
        <section aria-label="Revisión del contenido del paquete" className="space-y-3 rounded-lg border p-4">
          <h3 className="font-bold">Revisión del contenido del paquete</h3>
          {(answer?.status !== "verified" || explanation?.status !== "verified") && <p role="alert">Contenido pendiente de verificación. La respuesta y explicación pueden depender de supuestos o contener errores; revisa las observaciones.</p>}
          <p>Respuesta del archivo: {String(answer?.label ?? "Sin respuesta")} · Estado: {statusLabel(answer?.status)}</p>
          <h4>Explicación del archivo · {statusLabel(explanation?.status)}</h4>
          {explanation && Array.isArray(explanation.blocks) && explanation.blocks.length ? <PaessedBlocks blocks={explanation.blocks} assetUrls={resourceUrls.byId} loadingAssets={resourcesLoading} /> : <p>El archivo no contiene una explicación.</p>}
          {issues.length > 0 && <><h4>Observaciones del archivo</h4><ul>{issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul></>}
        </section>
      </article> : <p>No hay preguntas reconocibles en este paquete.</p>}
    </>}
    </div>
  </AppShell>;
}
