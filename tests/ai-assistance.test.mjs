import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_AI_SETTINGS, aiContentText, aiDestination, buildAiQuestionPrompt,
  customAiUrl, parseAiSettings,
} from "../lib/ai-assistance.ts";

describe("AI question handoff", () => {
  it("is opt-in and ignores malformed or unknown settings", () => {
    assert.deepEqual(parseAiSettings(null), DEFAULT_AI_SETTINGS);
    assert.deepEqual(parseAiSettings({ enabled: "yes", provider: "other", customUrl: 42 }), DEFAULT_AI_SETTINGS);
    assert.deepEqual(parseAiSettings({ enabled: true, provider: "gemini", customUrl: "" }),
      { enabled: true, provider: "gemini", customUrl: "" });
  });

  it("uses the selected provider, accepts custom HTTP(S) and blocks unsafe links", () => {
    assert.equal(aiDestination(DEFAULT_AI_SETTINGS), "https://chatgpt.com/");
    assert.equal(aiDestination({ ...DEFAULT_AI_SETTINGS, provider: "claude" }), "https://claude.ai/new");
    assert.equal(aiDestination({ ...DEFAULT_AI_SETTINGS, provider: "gemini" }), "https://gemini.google.com/app");
    assert.equal(aiDestination({ ...DEFAULT_AI_SETTINGS, provider: "grok" }), "https://grok.com/");
    assert.equal(aiDestination({ enabled: true, provider: "custom", customUrl: "https://mi-ia.example/chat" }), "https://mi-ia.example/chat");
    assert.equal(customAiUrl("http://localhost:3000/chat"), "http://localhost:3000/chat");
    for (const unsafe of ["", "javascript:alert(1)", "data:text/html,a", "file:///etc/passwd", "https://user:pass@example.com/"]) {
      assert.equal(customAiUrl(unsafe), null);
    }
  });

  it("transcribes LaTeX, tables, images and all labeled options without revealing answers", () => {
    const question = {
      number: 34,
      stem: [
        { type: "text", text: "Determina el valor de " },
        { type: "math", latex: "\\sqrt{25-24}" },
        { type: "text", text: ". Usa la tabla:" },
        { type: "table", rows: [
          [[{ type: "text", text: "x" }], [{ type: "math", latex: "2^3" }]],
          [[{ type: "text", text: "y" }], [{ type: "text", text: "8" }]],
        ] },
        { type: "image", asset_id: "g1", alt: "Gráfico de barras" },
      ],
      options: [
        { label: "A", content: [{ type: "math", latex: "\\sqrt{1}" }] },
        { label: "C", content: [{ type: "text", text: "2" }] },
      ],
      answer: "A",
      explanation: "SOLUCIONARIO OCULTO",
    };
    const prompt = buildAiQuestionPrompt(question);
    assert.match(prompt, /paso a paso/);
    assert.match(prompt, /Pregunta 34/);
    assert.match(prompt, /\\\(\\sqrt\{25-24\}\\\)/);
    assert.match(prompt, /\| x \| \\\(2\^3\\\) \|/);
    assert.match(prompt, /Imagen del ejercicio: Gráfico de barras/);
    assert.match(prompt, /A\) \\\(\\sqrt\{1\}\\\)/);
    assert.match(prompt, /C\) 2/);
    assert.doesNotMatch(prompt, /SOLUCIONARIO OCULTO/);
    assert.doesNotMatch(prompt, /answer:/);
  });

  it("keeps plain-text statements intact and marks unresolved content", () => {
    assert.equal(aiContentText("Si f(x)=2x+5, ¿cuánto vale f(6)?"), "Si f(x)=2x+5, ¿cuánto vale f(6)?");
    assert.match(aiContentText([{ type: "unresolved", reason: "OCR incompleto" }]), /OCR incompleto/);
    const prompt = buildAiQuestionPrompt({ number: "7", stem: "Pregunta original", options: [] });
    assert.doesNotMatch(prompt, /Alternativas:/);
    assert.match(prompt, /Pregunta original/);
  });
});
