"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { BankQuestion } from "@/lib/playground-imports";
import type { PlaygroundInkStroke } from "@/components/playground-scratchpad";
import { M1_UNITS } from "@/lib/m1-curriculum";
import { LearningQuestionWorkspace } from "../learning-question-workspace";
import styles from "./mobile-question.module.css";

/** Visual adapter only. Each caller owns its answers, navigation and delivery. */
export function ExternalQuestionWorkspace({ question, assetUrls, ready, error, retry, selected, onSelect, locked, checkedAnswer, revealSolution = false, context, sessionKey, number, total, subtitle, onClose, busy = false, steps, footer, notices, tools, initialStrokes, onStrokesChange, onReady, aiHelp, renderAiHelp }: {
  question: BankQuestion; assetUrls: Map<string,string>; ready: boolean; error?: string; retry?: () => void;
  selected: string; onSelect: (answer: string) => void; locked: boolean; checkedAnswer?: string; revealSolution?: boolean;
  context: "exam" | "playground"; sessionKey: string; number: number; total: number; subtitle: string;
  onClose: () => void; busy?: boolean; steps: { number: number; answered: boolean; current: boolean }[];
  footer: (drawing: boolean, aiHelp: ReactNode) => ReactNode; notices?: ReactNode; tools?: ReactNode;
  initialStrokes?: PlaygroundInkStroke[]; onStrokesChange?: (next: PlaygroundInkStroke[]) => void;
  renderAiHelp?: (onOpenChange: (open: boolean) => void) => ReactNode;
  onReady?: (ready: boolean) => void; aiHelp?: ReactNode;
}) {
  const [sheetReady, setSheetReady] = useState(false);
  const meta = useMemo(() => {
    const unit = M1_UNITS.find(item => item.id === question.unitId) ?? M1_UNITS[0];
    return { id: question.id, examId: question.sourceId, number: question.number, axisId: unit.axisId, unitId: unit.id, revision: "external", correct: question.correct ?? "", eligible: false };
  }, [question.id, question.sourceId, question.number, question.unitId, question.correct]);
  return <LearningQuestionWorkspace key={question.id} meta={meta} scratchpadKey={`${sessionKey}:${question.id}`} selected={selected ?? ""} checkedAnswer={checkedAnswer}
    onSelect={onSelect} locked={locked || !ready || !sheetReady} revealSolution={revealSolution} onReady={value => { setSheetReady(value); onReady?.(value); }}
    number={number} total={total} progress={steps.filter(step => step.answered).length} progressMax={total} subtitle={subtitle} onClose={onClose} busy={busy}
    steps={steps} showAiHelp={false} onAiHelp={() => {}} context={context} source={{ question, assetUrls, ready, error, retry }}
    tools={tools} aiHelp={aiHelp} renderAiHelp={renderAiHelp} initialStrokes={initialStrokes} onStrokesChange={onStrokesChange} notices={notices}
    footer={(drawing, help) => <div className={styles.sessionActions} inert={busy || !sheetReady || undefined}>{footer(drawing || !sheetReady, help)}</div>} />;
}
