"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { DEFAULT_EXAMS } from "@/lib/default-exams";
import { DEFAULT_QUESTION_INDEX } from "@/lib/learning/catalog";
import { useLearning } from "@/components/learning/use-learning";
import { readExamSession, saveExamSession, type SavedDefaultExamSession } from "@/lib/learning/exam-repository";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { LearningQuestionWorkspace } from "@/components/learning/learning-question-workspace";
import { QuestionDialog } from "@/components/learning/workspace/question-dialog";
import paperStyles from "@/components/learning/workspace/mobile-question.module.css";

export function DefaultExamSession({id}:{id:string}) {
  const router = useRouter();
  const exam=DEFAULT_EXAMS.find(e=>e.id===id);
  const questions=DEFAULT_QUESTION_INDEX.filter(q=>q.examId===id);
  const learning=useLearning();
  const [session,setSession]=useState<SavedDefaultExamSession|null>(null);
  const [error,setError]=useState(""); const [busy,setBusy]=useState(false);const [confirm,setConfirm]=useState(false);
  const [ready, setReady] = useState(false);
  useEffect(()=>{void readExamSession(id).then(value=>setSession(value)).catch(e=>setError(e.message));},[id]);
  const current=session?questions[session.index]:null;
  const update=async(next:NonNullable<typeof session>,change?:{questionId:string;answer:string})=>{setBusy(true);try{const committed=await saveExamSession(id,next,change);setSession(committed);setError("");}catch(e){setError(e instanceof Error?e.message:"No se pudo guardar el ensayo.");}finally{setBusy(false);}};
  const finish=async()=>{
    if(!session||session.evidenceDelivered||busy)return;setBusy(true);
    try{
      const frozen=await saveExamSession(id,{...session,completedAt:session.completedAt??new Date().toISOString()});setSession(frozen);
      for(const q of questions){const answer=frozen.answers[q.id];if(answer&&q.eligible){const result=await learning.dispatch({type:"external-attempt",questionId:q.id,answer,mode:"exam",sessionId:frozen.id});if(!result)throw new Error("No se pudieron registrar tus respuestas. Reintenta la entrega.");}}
      const committed=await saveExamSession(id,{...frozen,evidenceDelivered:true});setSession(committed);setError("");
    }catch(e){setError(e instanceof Error?e.message:"No se pudo finalizar.");}finally{setBusy(false);}
  };
  useEffect(()=>{if(session?.completedAt&&!session.evidenceDelivered&&!learning.loading)void finish();},[session?.id,session?.completedAt,session?.evidenceDelivered,learning.loading]);
  if(!exam)return <AppShell title="Ensayos"><h1>Ensayo no encontrado</h1><Link href="/app/ensayos">Volver</Link></AppShell>;
  const answered=session?Object.keys(session.answers).length:0;
  const correct=session?questions.filter(q=>session.answers[q.id]===q.correct).length:0;
  if (session && !session.completedAt && current && !learning.loading) return <AppShell title="Ensayos" immersive>
    <LearningQuestionWorkspace key={current.id} meta={current} context="exam" scratchpadKey={`${session.id}:${current.id}`}
      selected={session.answers[current.id] ?? ""} onSelect={answer => { const answers = { ...session.answers }; if (answer) answers[current.id] = answer; else delete answers[current.id]; void update({ ...session, answers }, { questionId: current.id, answer }); }}
      locked={busy} revealSolution={false} onReady={value => { setReady(value); if (value) void learning.dispatch({ type: "expose", questionId: current.id, sessionId: session.id, mode: "exam" }); }}
      number={current.number} total={questions.length} progress={answered} progressMax={questions.length} subtitle={`${exam.title} · ${session.index + 1} de ${questions.length} · ${answered} respondidas`}
      onClose={() => { if (!busy) router.push("/app/ensayos"); }} busy={busy} steps={questions.map((question,index) => ({ number: index + 1, answered: !!session.answers[question.id], current: index === session.index }))}
      showAiHelp={false} onAiHelp={() => {}} notices={error || learning.error ? <p role="alert" className="mb-3 text-sm text-rose-600">{error || learning.error}</p> : undefined}
      tools={<div className="space-y-3"><label className="block text-base">Ir a pregunta<select aria-label="Ir a pregunta" className="ml-3 min-h-11 rounded border bg-[var(--pg-bg)] px-3" disabled={busy} value={session.index} onChange={event => { setReady(false); void update({ ...session, index: Number(event.target.value) }); }}>{questions.map((question,index) => <option key={question.id} value={index}>{index + 1}{session.answers[question.id] ? " ✓" : ""}</option>)}</select></label><button type="button" className="min-h-12 rounded border px-4" disabled={busy} onClick={() => setConfirm(true)}>Entregar ensayo</button></div>}
      footer={drawing => <div className={paperStyles.sessionActions}><button type="button" disabled={busy || drawing || session.index === 0} className="min-h-12 rounded-xl border px-3 disabled:opacity-40" onClick={() => { setReady(false); void update({ ...session, index: session.index - 1 }); }}>Anterior</button>{session.index < questions.length - 1 ? <button type="button" disabled={busy || drawing} className="tactile-primary min-h-12 rounded-xl px-5" onClick={() => { setReady(false); void update({ ...session, index: session.index + 1 }); }}>Siguiente</button> : <button type="button" disabled={busy || drawing || !ready} className="tactile-primary min-h-12 rounded-xl px-4" onClick={() => setConfirm(true)}>Entregar ensayo</button>}</div>} />
    {confirm && <QuestionDialog title="¿Entregar el ensayo?" wide onClose={() => { if (!busy) setConfirm(false); }}><p>{questions.length - answered} preguntas quedarán omitidas. Las respuestas entregadas se conservarán.</p><div className="mt-5 flex flex-wrap gap-3"><button type="button" className="min-h-12 rounded border px-4" disabled={busy} onClick={() => setConfirm(false)}>Seguir revisando</button><button type="button" className="tactile-primary min-h-12 rounded px-4" disabled={busy} onClick={() => void finish()}>{busy ? "Guardando…" : "Confirmar entrega"}</button></div></QuestionDialog>}
  </AppShell>;
  return <AppShell title="Ensayos" eyebrow={exam.title} immersive={!!session&&!session.completedAt}>
    <div className={session?.completedAt?"surface rounded-3xl p-6 sm:p-10":"fixed inset-0 z-50 flex h-dvh flex-col bg-[var(--surface)] text-[var(--text)]"}>
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] p-4 sm:px-8"><Link href="/app/ensayos" className="soft-button inline-flex min-h-11 items-center gap-2 rounded-xl px-4"><ArrowLeft size={17}/>Guardar y salir</Link><div className="text-right"><h1 className="text-sm font-extrabold">{exam.title}</h1><p className="text-xs text-[var(--muted)]">{answered}/{questions.length} respondidas · Guardado en este navegador</p></div></header>
      {(error||learning.error)&&<p role="alert" className="bg-red-50 p-3 text-rose-700">{error||learning.error}</p>}
      {!session||learning.loading?<p className="p-8" role="status">Cargando tu ensayo…</p>:<section className="mx-auto max-w-2xl py-12 text-center"><CheckCircle2 size={50} className="mx-auto text-emerald-500"/><h2 className="mt-5 text-3xl font-extrabold">Ensayo finalizado</h2><p className="mt-4 text-lg">{correct} correctas · {answered-correct} incorrectas · {questions.length-answered} omitidas</p><p className="mt-3 text-sm text-[var(--muted)]">{session.evidenceDelivered?"Tus primeras respuestas nuevas dentro del temario aportaron evidencia al perfil. Este resultado no se convierte en puntaje PAES.":"Tus respuestas ya están entregadas. Falta terminar su registro en el perfil."}</p>{!session.evidenceDelivered&&<button disabled={busy} onClick={()=>void finish()} className="soft-button mt-4 min-h-11 rounded-xl px-4">{busy?"Guardando evidencia…":"Reintentar guardado"}</button>}<Link href="/app/aprender" className="tactile-primary mt-8 inline-flex min-h-12 items-center gap-2 rounded-xl px-6">Ver mi ruta <ArrowRight size={17}/></Link></section>}
    </div>
  </AppShell>;
}
