import Emphasis from "./paessed-runtime/block-renderer.js";
type RecordLike = Record<string, unknown>;

/** Exclude answer, explanation and review metadata from legacy image discovery. */
export function questionVisibleContent(question: unknown): unknown {
  if (!isRecord(question)) return question;
  return [question.stem, question.prompt, question.statement, question.text, question.content, question.body,
    question.options, question.alternatives, question.choices, question.answers,
    question.image, question.images, question.assets, question.assetPaths];
}

export function isRecord(value: unknown): value is RecordLike {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nested(record: RecordLike, ...keys: string[]): unknown {
  let current: unknown = record;
  for (const key of keys) {
    if (!isRecord(current)) return undefined;
    current = current[key];
  }
  return current;
}

export function getQuestions(document: unknown): unknown[] {
  if (!isRecord(document)) return [];
  const candidates = [
    document.questions,
    document.items,
    nested(document, "exam", "questions"),
    nested(document, "test", "questions"),
    nested(document, "content", "questions"),
    nested(document, "data", "questions"),
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}

export function getQuestionId(question: unknown, index: number): string {
  if (!isRecord(question)) return String(index + 1);
  const value = question.id ?? question.question_id ?? question.questionId ?? question.number ?? question.index;
  return typeof value === "string" || typeof value === "number" ? String(value) : String(index + 1);
}

function flatten(value: unknown, depth = 0): string {
  if (depth > 7 || value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number") return typeof value === "string" ? Emphasis.plainText(value) : String(value);
  if (Array.isArray(value)) return value.map((item) => flatten(item, depth + 1)).filter(Boolean).join(" ");
  if (!isRecord(value)) return "";

  const type = typeof value.type === "string" ? value.type.toLowerCase() : "";
  if (type === "text") return flatten(value.text ?? value.content ?? value.value, depth + 1);
  if (type === "math") {
    const latex = value.latex ?? value.value ?? value.content;
    return typeof latex === "string" ? latex : "";
  }
  if (type === "table" && Array.isArray(value.rows)) return flatten(value.rows, depth + 1);

  for (const key of ["text", "prompt", "statement", "stem", "content", "body", "question", "label"]) {
    if (key in value) {
      const text = flatten(value[key], depth + 1);
      if (text) return text;
    }
  }
  return "";
}

export function questionText(question: unknown): string {
  if (!isRecord(question)) return "Pregunta sin texto reconocible.";
  for (const candidate of [question.stem, question.prompt, question.statement, question.text, question.content, question.body]) {
    const text = flatten(candidate).replace(/\s+/g, " ").trim();
    if (text) return text;
  }
  return "Pregunta sin texto reconocible.";
}

export function getOptions(question: unknown): Array<{ key: string; text: string; blocks?: unknown[] }> {
  if (!isRecord(question)) return [];
  const candidate = question.options ?? question.alternatives ?? question.choices ?? question.answers;
  if (!Array.isArray(candidate)) return [];
  return candidate.map((option, index) => {
    if (typeof option === "string" || typeof option === "number") return { key: String.fromCharCode(65 + index), text: typeof option === "string" ? Emphasis.plainText(option) : String(option) };
    if (isRecord(option)) {
      const key = option.label ?? option.key ?? option.id ?? String.fromCharCode(65 + index);
      const text = flatten(option.blocks ?? option.content ?? option.text ?? option.value).replace(/\s+/g, " ").trim();
      return { key: String(key), text: text || "Alternativa sin texto reconocible.", blocks: Array.isArray(option.blocks) ? option.blocks : undefined };
    }
    return { key: String.fromCharCode(65 + index), text: "Alternativa sin texto reconocible." };
  });
}
