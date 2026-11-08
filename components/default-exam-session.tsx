"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { LearningQuestionCard } from "@/components/learning/question-card";
import { DEFAULT_EXAMS } from "@/lib/default-exams";
import { DEFAULT_QUESTION_INDEX } from "@/lib/learning/catalog";
import { useLearning } from "@/components/learning/use-learning";
import { readExamSession, saveExamSession, type SavedDefaultExamSession } from "@/lib/learning/exam-repository";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";

export function DefaultExamSession({id}:{id:string}) {
  const exam=DEFAULT_EXAMS.find(e=>e.id===id);
  const questions=DEFAULT_QUESTION_INDEX.filter(q=>q.examId===id);
  const learning=useLearning();
  const [session,setSession]=useState<SavedDefaultExamSession|null>(null);
  const [error,setError]=useState(""); const [busy,setBusy]=useState(false);const [confirm,setConfirm]=useState(false);
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
  return <AppShell title="Ensayos" eyebrow={exam.title} immersive={!!session&&!session.completedAt}>
    <div className={session?.completedAt?"surface rounded-3xl p-6 sm:p-10":"fixed inset-0 z-50 flex h-dvh flex-col bg-[var(--surface)] text-[var(--text)]"}>
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] p-4 sm:px-8"><Link href="/app/ensayos" className="soft-button inline-flex min-h-11 items-center gap-2 rounded-xl px-4"><ArrowLeft size={17}/>Guardar y salir</Link><div className="text-right"><h1 className="text-sm font-extrabold">{exam.title}</h1><p className="text-xs text-[var(--muted)]">{answered}/{questions.length} respondidas · Guardado en este navegador</p></div></header>
      {(error||learning.error)&&<p role="alert" className="bg-red-50 p-3 text-rose-700">{error||learning.error}</p>}
      {!session||learning.loading?<p className="p-8" role="status">Cargando tu ensayo…</p>:session.completedAt?<section className="mx-auto max-w-2xl py-12 text-center"><CheckCircle2 size={50} className="mx-auto text-emerald-500"/><h2 className="mt-5 text-3xl font-extrabold">Ensayo finalizado</h2><p className="mt-4 text-lg">{correct} correctas · {answered-correct} incorrectas · {questions.length-answered} omitidas</p><p className="mt-3 text-sm text-[var(--muted)]">{session.evidenceDelivered?"Tus primeras respuestas nuevas dentro del temario aportaron evidencia al perfil. Este resultado no se convierte en puntaje PAES.":"Tus respuestas ya están entregadas. Falta terminar su registro en el perfil."}</p>{!session.evidenceDelivered&&<button disabled={busy} onClick={()=>void finish()} className="soft-button mt-4 min-h-11 rounded-xl px-4">{busy?"Guardando evidencia…":"Reintentar guardado"}</button>}<Link href="/app/aprender" className="tactile-primary mt-8 inline-flex min-h-12 items-center gap-2 rounded-xl px-6">Ver mi ruta <ArrowRight size={17}/></Link></section>:<>
        <div className="h-1.5 shrink-0 bg-[var(--surface-3)]"><div className="h-full bg-[var(--primary)]" style={{width:`${answered/questions.length*100}%`}}/></div>
        <main className="flex-1 overflow-y-auto p-5 sm:p-8"><div className="mx-auto max-w-[820px]"><div className="mb-5 flex items-center justify-between text-xs text-[var(--muted)]"><span>Pregunta {session.index+1} de {questions.length}</span><span>{current?.eligible?"M1 · Temario actual":"Pregunta histórica · Fuera del temario actual"}</span></div>{current&&<LearningQuestionCard meta={current} selected={session.answers[current.id]} locked={busy} scratchpadKey={`${session.id}:${current.id}`} onReady={ready=>{if(ready)void learning.dispatch({type:"expose",questionId:current.id,sessionId:session.id,mode:"exam"});}} onSelect={answer=>{void update({...session,answers:{...session.answers,[current.id]:answer}},{questionId:current.id,answer});}}/>}</div></main>
        <footer className="shrink-0 border-t border-[var(--border)] p-4"><div className="mx-auto flex max-w-[820px] flex-wrap items-center justify-between gap-3"><button disabled={busy||session.index===0} className="soft-button min-h-11 rounded-xl px-4 disabled:opacity-40" onClick={()=>void update({...session,index:session.index-1})}>Anterior</button><label className="text-xs">Ir a <select aria-label="Ir a pregunta" className="ml-2 min-h-11 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2" value={session.index} onChange={e=>void update({...session,index:Number(e.target.value)})}>{questions.map((q,i)=><option value={i} key={q.id}>{i+1}{session.answers[q.id]?" ✓":""}</option>)}</select></label>{session.index<questions.length-1?<button disabled={busy} className="tactile-primary min-h-11 rounded-xl px-5" onClick={()=>void update({...session,index:session.index+1})}>Siguiente</button>:<button disabled={busy} className="tactile-primary min-h-11 rounded-xl px-5" onClick={()=>setConfirm(true)}>Entregar ensayo</button>}</div></footer>
      </>}
      {confirm&&session&&!session.completedAt&&<div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/60 p-5"><section role="dialog" aria-modal="true" aria-labelledby="gold-finish" className="surface max-w-md rounded-2xl p-6"><h2 id="gold-finish" className="text-xl font-extrabold">¿Entregar el ensayo?</h2><p className="mt-3 text-sm text-[var(--muted)]">{questions.length-answered} preguntas quedarán omitidas. Las respuestas entregadas se conservarán.</p><div className="mt-6 flex gap-3"><button autoFocus disabled={busy} className="soft-button min-h-11 rounded-xl px-4" onClick={()=>setConfirm(false)}>Seguir revisando</button><button disabled={busy} className="tactile-primary min-h-11 rounded-xl px-4" onClick={()=>void finish()}>{busy?"Guardando…":"Confirmar entrega"}</button></div></section></div>}
    </div>
  </AppShell>;
}
