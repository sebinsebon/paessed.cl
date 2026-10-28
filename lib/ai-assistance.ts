export const AI_SETTINGS_KEY = "paessed-ai-assistance-v1";
export const AI_SETTINGS_EVENT = "paessed-ai-assistance-changed";

export const AI_PROVIDERS = [
  { id: "chatgpt", label: "ChatGPT", url: "https://chatgpt.com/" },
  { id: "claude", label: "Claude", url: "https://claude.ai/new" },
  { id: "gemini", label: "Gemini", url: "https://gemini.google.com/app" },
  { id: "grok", label: "Grok", url: "https://grok.com/" },
  { id: "custom", label: "Personalizada", url: "" },
] as const;

export type AiProvider = (typeof AI_PROVIDERS)[number]["id"];
export type AiSettings = {
  enabled: boolean;
  provider: AiProvider;
  customUrl: string;
};

export type AiQuestion = {
  number: string | number;
  stem: unknown;
  options: Array<{ label: string; content: unknown }>;
};

export const DEFAULT_AI_SETTINGS: AiSettings = {
  enabled: false,
  provider: "chatgpt",
  customUrl: "",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function parseAiSettings(value: unknown): AiSettings {
  if (!isRecord(value)) return { ...DEFAULT_AI_SETTINGS };
  const provider = AI_PROVIDERS.find((item) => item.id === value.provider)?.id ?? "chatgpt";
  return {
    enabled: value.enabled === true,
    provider,
    customUrl: typeof value.customUrl === "string" ? value.customUrl.slice(0, 2048) : "",
  };
}

export function readAiSettings(): AiSettings {
  if (typeof window === "undefined") return { ...DEFAULT_AI_SETTINGS };
  try {
    const raw = window.localStorage.getItem(AI_SETTINGS_KEY);
    return raw ? parseAiSettings(JSON.parse(raw)) : { ...DEFAULT_AI_SETTINGS };
  } catch {
    return { ...DEFAULT_AI_SETTINGS };
  }
}

export function saveAiSettings(settings: AiSettings): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(parseAiSettings(settings)));
  } catch {
    // Settings remain usable in memory if the browser blocks local storage.
  }
  window.dispatchEvent(new Event(AI_SETTINGS_EVENT));
}

export function customAiUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (!["https:", "http:"].includes(url.protocol) || !url.hostname || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function aiDestination(settings: AiSettings): string | null {
  if (settings.provider === "custom") return customAiUrl(settings.customUrl);
  return AI_PROVIDERS.find((provider) => provider.id === settings.provider)?.url ?? null;
}

/** Preserve the source LaTeX and row structure rather than copying KaTeX's rendered DOM. */
export function aiContentText(value: unknown, depth = 0): string {
  if (depth > 16 || value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map((item) => aiContentText(item, depth + 1)).join("");
  if (!isRecord(value)) return "";

  switch (value.type) {
    case "text": return aiContentText(value.text ?? value.content ?? value.value, depth + 1);
    case "math": {
      const latex = aiContentText(value.latex ?? value.value, depth + 1);
      return value.display ? `\n\\[${latex}\\]\n` : `\\(${latex}\\)`;
    }
    case "image": return `\n[Imagen del ejercicio${value.alt ? `: ${String(value.alt)}` : ""}. Adjuntar manualmente si es necesaria.]\n`;
    case "table": {
      if (!Array.isArray(value.rows)) return "[Tabla sin transcripción]";
      return "\n" + value.rows.map((row) =>
        Array.isArray(row) ? "| " + row.map((cell) => aiContentText(cell, depth + 1).trim()).join(" | ") + " |" : ""
      ).join("\n") + "\n";
    }
    case "unresolved": return `\n[Contenido pendiente: ${String(value.reason ?? "no transcrito")}]\n`;
    default: {
      for (const key of ["blocks", "content", "text", "value", "stem", "prompt", "statement", "body"]) {
        if (key in value) return aiContentText(value[key], depth + 1);
      }
      return "";
    }
  }
}

export function buildAiQuestionPrompt(question: AiQuestion): string {
  const stem = aiContentText(question.stem).trim() || "[Enunciado no transcrito]";
  const options = question.options.map((option) => {
    const content = aiContentText(option.content).trim() || "[Alternativa no transcrita]";
    return `${option.label}) ${content}`;
  });
  return [
    "Necesito que me expliques este ejercicio paso a paso, partiendo por leer el enunciado. Primero explica qué datos entrega, qué pide y cómo identificar el método de solución. Luego resuélvelo justificando cada paso con claridad.",
    `Pregunta ${question.number}`,
    "Enunciado:",
    stem,
    ...(options.length ? ["Alternativas:", ...options] : []),
    "Si alguna imagen o parte del ejercicio no está transcrita, indícamelo antes de asumir su contenido.",
  ].join("\n\n");
}
