/**
 * Schema-preserving helpers for local .paessed edits.
 *
 * Only scalar fields are changed. Rich math/media/table blocks and the other
 * properties of each question are never flattened or rewritten.
 */
export type JsonObject = Record<string, unknown>;
export type FieldPath = Array<string | number>;

export type OptionView = {
  key: string;
  text: string;
  editablePath: FieldPath | null;
};

export type QuestionView = {
  number: string;
  numberPath: FieldPath | null;
  stem: string;
  stemPath: FieldPath | null;
  options: OptionView[];
  answer: string;
  answerPath: FieldPath | null;
  answerEditable: boolean;
  complexAnswer: boolean;
};

export type QuestionPatch = {
  number: string;
  stem: string;
  options: string[];
  answer: string;
};

const QUESTION_PATHS: FieldPath[] = [
  ["questions"], ["items"], ["exam", "questions"], ["test", "questions"],
  ["content", "questions"], ["data", "questions"],
];
const NUMBER_FIELDS = ["number", "index"];
const STEM_FIELDS = ["stem", "prompt", "statement", "text", "content", "body"];
const ANSWER_FIELDS = ["correct_answer", "correctAnswer", "answer", "correct_option", "correctOption", "key"];
const SOLUTION_FIELDS = ["answer", "correct_answer", "correct", "option", "key"];
const NESTED_ANSWER_FIELDS = ["option", "key", "answer", "correct", "value", "id", "option_id", "optionId"];
const OPTION_FIELDS = ["options", "alternatives", "choices", "answers"];

export function isJsonObject(value: unknown): value is JsonObject {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function readPath(source: unknown, path: FieldPath): unknown {
  let current = source;
  for (const key of path) {
    if (!isJsonObject(current) && !Array.isArray(current)) return undefined;
    current = (current as JsonObject)[String(key)];
  }
  return current;
}

function writePath(source: unknown, path: FieldPath, value: unknown): void {
  if (!path.length) throw new Error("Ruta de edición no válida.");
  const target = readPath(source, path.slice(0, -1));
  if (!isJsonObject(target) && !Array.isArray(target)) throw new Error("Campo incompatible con la edición visual.");
  (target as JsonObject)[String(path[path.length - 1])] = value;
}

function locateQuestions(document: unknown): { path: FieldPath; questions: unknown[] } | null {
  for (const path of QUESTION_PATHS) {
    const candidate = readPath(document, path);
    if (Array.isArray(candidate)) return { path, questions: candidate };
  }
  return null;
}

export function getEditableQuestions(document: unknown): unknown[] {
  return locateQuestions(document)?.questions ?? [];
}

function scalar(value: unknown): value is string | number {
  return typeof value === "string" || (typeof value === "number" && Number.isFinite(value));
}

function textPath(question: JsonObject): FieldPath | null {
  for (const field of STEM_FIELDS) {
    const value = question[field];
    if (Array.isArray(value) && value.length === 1 && isJsonObject(value[0]) && value[0].type === "text" && typeof value[0].text === "string") return [field, 0, "text"];
    if (typeof value === "string") return [field];
    if (isJsonObject(value) && value.type === "text" && typeof value.text === "string") return [field, "text"];
  }
  return null;
}

function optionsView(question: JsonObject): OptionView[] {
  const field = OPTION_FIELDS.find((key) => Array.isArray(question[key]));
  if (!field) return [];
  const options = question[field] as unknown[];
  return options.map((value, index) => {
    if (typeof value === "string") return { key: String.fromCharCode(65 + index), text: value, editablePath: [field, index] };
    if (typeof value === "number") return { key: String.fromCharCode(65 + index), text: String(value), editablePath: null };
    if (isJsonObject(value)) {
      const key = value.label ?? value.key ?? value.id ?? String.fromCharCode(65 + index);
      if(Array.isArray(value.blocks) && value.blocks.length===1 && isJsonObject(value.blocks[0]) && value.blocks[0].type=== "text" && typeof value.blocks[0].text=== "string") return {key:String(key),text:value.blocks[0].text,editablePath:[field,index,"blocks",0,"text"]};
      for (const property of ["text", "content", "value"]) {
        if (typeof value[property] === "string") return { key: String(key), text: value[property] as string, editablePath: [field, index, property] };
      }
      if (isJsonObject(value.content) && value.content.type === "text" && typeof value.content.text === "string") {
        return { key: String(key), text: value.content.text, editablePath: [field, index, "content", "text"] };
      }
      return { key: String(key), text: "Contenido estructurado (sin edición de texto simple)", editablePath: null };
    }
    return { key: String.fromCharCode(65 + index), text: "Formato no compatible", editablePath: null };
  });
}

function answerLocation(question: JsonObject): { path: FieldPath | null; complex: boolean; value: string } {
  if(isJsonObject(question.answer) && "label" in question.answer) return {path:["answer","label"],complex:false,value: typeof question.answer.label === "string" ? question.answer.label : ""};
  const roots: FieldPath[] = [
    ...ANSWER_FIELDS.map((key): FieldPath => [key]),
    ...(isJsonObject(question.solution) ? SOLUTION_FIELDS.map((key): FieldPath => ["solution", key]) : []),
  ];
  for (const root of roots) {
    const value = readPath(question, root);
    if (value === undefined || value === null || value === "") continue;
    if (scalar(value)) return { path: root, complex: false, value: String(value) };
    if (isJsonObject(value)) {
      for (const nested of NESTED_ANSWER_FIELDS) {
        if (scalar(value[nested])) return { path: [...root, nested], complex: false, value: String(value[nested]) };
      }
      return { path: null, complex: true, value: "Respuesta estructurada" };
    }
    return { path: null, complex: true, value: "Respuesta estructurada" };
  }
  return { path: ["correct_answer"], complex: false, value: "" };
}

export function inspectQuestion(source: unknown, index: number): QuestionView {
  const question = getEditableQuestions(source)[index];
  if (!isJsonObject(question)) throw new Error("La pregunta seleccionada tiene un formato no editable.");
  const numberField = NUMBER_FIELDS.find((field) => scalar(question[field]));
  const numberPath = numberField ? [numberField] : null;
  const stemPath = textPath(question);
  const answer = answerLocation(question);
  return {
    number: numberField ? String(question[numberField]) : String(index + 1),
    numberPath,
    stem: stemPath ? String(readPath(question, stemPath) ?? "") : "",
    stemPath,
    options: optionsView(question),
    answer: answer.value,
    answerPath: answer.path,
    answerEditable: !answer.complex,
    complexAnswer: answer.complex,
  };
}

function castLike(original: unknown, value: string): string | number {
  if (typeof original === "number") {
    const numeric = Number(value);
    if (!value.trim() || !Number.isFinite(numeric)) throw new Error("Este identificador debe ser numérico.");
    return numeric;
  }
  return value.trim();
}

export function applyQuestionPatch(source: unknown, index: number, patch: QuestionPatch): unknown {
  const originalView = inspectQuestion(source, index);
  const number = patch.number.trim();
  if (!number) throw new Error("El número o identificador de la pregunta no puede estar vacío.");
  const questionsBefore = getEditableQuestions(source);
  for (let i = 0; i < questionsBefore.length; i++) {
    if (i !== index && inspectQuestion(source, i).number === number) {
      throw new Error("Ya existe una pregunta con ese identificador.");
    }
  }
  const location = locateQuestions(source);
  if (!location) throw new Error("No se encontró una lista de preguntas compatible.");
  const cloned = structuredClone(source);
  const question = readPath(cloned, [...location.path, index]);
  if (!isJsonObject(question)) throw new Error("No se puede modificar esta pregunta.");

  if (number !== originalView.number) {
    const path = originalView.numberPath;
    if(!path) throw new Error("Esta pregunta no tiene un número editable. El ID permanece inmutable.");
    writePath(question, path, castLike(readPath(question, path), number));
  }
  if (patch.stem !== originalView.stem) {
    if (!originalView.stemPath) throw new Error("El enunciado contiene bloques complejos y no se puede editar como texto simple.");
    if (!patch.stem.trim()) throw new Error("El enunciado no puede quedar vacío.");
    writePath(question, originalView.stemPath, patch.stem);
  }
  for (let i = 0; i < originalView.options.length; i++) {
    const existing = originalView.options[i];
    const next = patch.options[i] ?? existing.text;
    if (next !== existing.text) {
      if (!existing.editablePath) throw new Error("La alternativa " + existing.key + " tiene contenido complejo que no se puede editar aquí.");
      if (!next.trim()) throw new Error("La alternativa " + existing.key + " no puede quedar vacía.");
      writePath(question, existing.editablePath, next);
    }
  }
  if (patch.answer !== originalView.answer) {
    if (!originalView.answerEditable || !originalView.answerPath) throw new Error("La respuesta tiene una estructura avanzada que no se puede editar en este formulario.");
    if (!patch.answer.trim()) throw new Error("Debes elegir una respuesta correcta.");
    const previousValue = readPath(question, originalView.answerPath);
    const usesNumericCode = typeof previousValue === "number";
    const hasValidOptionKey = originalView.options.some((option) => option.key === patch.answer);
    const hasNumericCode = usesNumericCode && /^[0-9]+$/.test(patch.answer) && Number(patch.answer) >= 0 && Number(patch.answer) <= originalView.options.length;
    if (originalView.options.length && !hasValidOptionKey && !hasNumericCode) {
      throw new Error(usesNumericCode ? "Usa el índice numérico que utiliza este solucionario." : "La respuesta debe coincidir con una de las alternativas.");
    }
    writePath(question, originalView.answerPath, castLike(previousValue, patch.answer));
  }
  if(isJsonObject(cloned) && cloned.format==='paessed-benchmark'){
    const contentChanged=patch.stem!==originalView.stem || patch.options.some((text,i)=>text!==originalView.options[i]?.text);
    const identityChanged=number!==originalView.number;
    const answerChanged=patch.answer!==originalView.answer;
    if(identityChanged && isJsonObject(cloned.exam) && Array.isArray(cloned.exam.expected_questions)){
      for(const expected of cloned.exam.expected_questions)if(isJsonObject(expected)&&expected.id===question.id)expected.number=number;
    }
    if(contentChanged||identityChanged){
      question.fidelity={status:'pending',review_ref:null};
      if(contentChanged && isJsonObject(question.curriculum)){question.curriculum={eje:null,subeje:null,en_temario:'dudoso'};}
      if(isJsonObject(question.answer)){question.answer.status=question.answer.label==null?'missing':'provisional';question.answer.source_ref=null;question.answer.origin=question.answer.label==null?'none':'model';}
    }
    if(answerChanged && isJsonObject(question.answer)){question.answer.status='provisional';question.answer.origin='model';question.answer.source_ref=null;}
    if((contentChanged||answerChanged||identityChanged) && isJsonObject(question.explanation))question.explanation.status=Array.isArray(question.explanation.blocks)&&question.explanation.blocks.length?'provisional':'missing';
    if(contentChanged||answerChanged||identityChanged){
      const issues=Array.isArray(question.issues)?question.issues as string[]:[];
      question.issues=[...new Set([...issues,'USER_EDITED',...(contentChanged && isJsonObject(question.curriculum)?['CURRICULUM_PENDING']:[])])];
      if(isJsonObject(cloned.run)){cloned.run.eligible=false;delete cloned.run.accuracy;delete cloned.run.gold_certification;delete cloned.run.certification;delete cloned.run.quality;cloned.run.web_edit={question_id:question.id,edited_at:new Date().toISOString(),requires_review:true};}
    }
  }
  return cloned;
}

export function answerCount(document: unknown): number {
  return getEditableQuestions(document).filter((question) => isJsonObject(question) && !!answerLocation(question).value).length;
}
