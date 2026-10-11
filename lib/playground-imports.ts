import { getImportedExam, listImportedExams } from "@/lib/local-imports";
import { M1_UNITS, type M1UnitId } from "@/lib/m1-curriculum";

type Data = Record<string, unknown>;
const record = (x: unknown): x is Data => !!x && typeof x === "object" && !Array.isArray(x);
const nested = (x: unknown, key: string): unknown => record(x) ? x[key] : undefined;

export type BankQuestion = {
  id: string; number: number; year: number | null; collection: string;
  sourceId: string; axis: string; topic: string; unitId: M1UnitId | null;
  stem: string; options: string[]; correct: string | null; explanation: string;
  assetPaths?: string[];
};
export type BankSource = { id: string; name: string; fileName?: string; count: number; imported: boolean };

export function getImportedQuestions(data: unknown): unknown[] {
  if (!record(data)) return [];
  const candidates = [
    data.questions, data.items, nested(data.exam,"questions"), nested(data.test,"questions"),
    nested(data.content,"questions"), nested(data.data,"questions"),
  ];
  return candidates.find(Array.isArray) as unknown[] ?? [];
}

function flatten(value: unknown, depth = 0): string {
  if (depth > 9 || value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map((v) => flatten(v,depth+1)).filter(Boolean).join(" ");
  if (!record(value)) return "";
  if (value.type === "math") return flatten(value.latex ?? value.value ?? value.content,depth+1);
  if (value.type === "table" && Array.isArray(value.rows)) return flatten(value.rows,depth+1);
  for (const field of ["text","prompt","statement","stem","content","body","question","value","label"]) {
    if (field in value) {
      const text = flatten(value[field],depth+1);
      if (text) return text;
    }
  }
  return "";
}
function readText(value: unknown): string { return flatten(value).replace(/\s+/g," ").trim(); }
function firstText(...values: unknown[]): string {
  for (const v of values) { const text = readText(v); if (text) return text; }
  return "";
}
function referenceImages(value: unknown): string[] {
  const found = new Set<string>();
  const visit = (v: unknown, depth: number) => {
    if (depth > 10 || v == null) return;
    if (typeof v === "string") {
      const normalized = v.replace(/\\/g,"/");
      for (const match of normalized.match(/(?:^|\/)assets\/[^?#\s"'<>]+?\.(?:png|jpe?g|webp|gif|svg)(?=[?#\s"'<>]|$)/gi) ?? []) {
        found.add(match.replace(/^.*?(assets\/)/i,"assets/"));
      }
    } else if (Array.isArray(v)) v.forEach((x) => visit(x,depth+1));
    else if (record(v)) Object.values(v).forEach((x) => visit(x,depth+1));
  };
  visit(value,0);
  return [...found];
}
function letter(value: unknown): string | null {
  const direct = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim().toUpperCase() : "";
  return /^[A-E]$/.test(direct) ? direct : null;
}
function tagUnit(item: Data): M1UnitId | null {
  const raw = firstText(item.unitId,item.unit_id,item.subeje,item.subtopic,item.topic);
  const unit = M1_UNITS.find((candidate) =>
    candidate.id === raw || candidate.name.toLocaleLowerCase("es") === raw.toLocaleLowerCase("es"));
  return unit?.id ?? null;
}
export function convertImportedExamQuestions(examId: string, title: string, json: unknown): BankQuestion[] {
  const items = getImportedQuestions(json);
  return items.map((raw, index) => {
    const question = record(raw) ? raw : {};
    const unitId = tagUnit(question);
    const unit = M1_UNITS.find((candidate) => candidate.id === unitId);
    const sourceYear = firstText(record(json) ? json.year : null,record(json) ? nested(json.metadata,"year") : null);
    const year = /^20\d{2}$/.test(sourceYear) ? Number(sourceYear) : null;
    const optionData = question.options ?? question.alternatives ?? question.choices;
    const options = Array.isArray(optionData) ? optionData.map((entry) =>
      record(entry) ? firstText(entry.content,entry.text,entry.value,entry.label) : readText(entry)
    ) : [];
    const solution = record(question.solution) ? question.solution : {};
    const correct = letter(question.correct_answer ?? question.correctAnswer ?? question.correct_option ??
      question.correctOption ?? question.answer ?? solution.answer ?? solution.correct_answer);
    const num = question.number ?? question.question_number ?? question.questionId ?? question.id;
    const number = typeof num === "number" && Number.isFinite(num) ? num :
      typeof num === "string" && /^\d+$/.test(num) ? Number(num) : index+1;
    return {
      id: "imported:" + examId + ":" + index,
      sourceId: "imported:" + examId,
      number, year, collection:title, axis:unit?.axisName ?? "Sin clasificar",
      topic:unit?.name ?? "Sin subeje asignado", unitId,
      stem:firstText(question.stem,question.prompt,question.statement,question.text,question.content,question.body) || "Pregunta sin texto reconocible.",
      options,correct,explanation:firstText(solution.explanation,question.explanation) || "",
      assetPaths:referenceImages(question),
    };
  });
}
export async function loadPlaygroundImports() {
  const summaries = await listImportedExams();
  const results = await Promise.all(summaries.map(async (item) => {
    try {
      const full = await getImportedExam(item.id);
      return { summary:item, questions:full ? convertImportedExamQuestions(item.id,item.title,full.finalJson):[], archive:full?.archive };
    } catch {
      return { summary:item, questions:[] as BankQuestion[],archive:undefined };
    }
  }));
  return {
    sources:results.map((item):BankSource=>({
      id:"imported:"+item.summary.id,name:item.summary.title,fileName:item.summary.fileName,
      count:item.questions.length,imported:true,
    })),
    questions:results.flatMap((item) => item.questions),
    archives:Object.fromEntries(results.filter((item)=>Boolean(item.archive)).map((item)=>["imported:"+item.summary.id,item.archive!])) as Record<string,Blob>,
  };
}
