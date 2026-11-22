import assert from "node:assert/strict";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import sharp from "sharp";

const origin = new URL(process.env.PAESSED_CAPTURE_URL ?? "http://127.0.0.1:3262").origin;
assert.match(origin, /^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/, "Capture only from a local server");
const catalog = JSON.parse(await readFile(new URL("../../lib/default-catalog.json", import.meta.url)));
const output = new URL("../../out/unslop-site/screens/", import.meta.url);
const account = { id: "a640043b-52f4-4977-9021-70ace05bcdb1", email: "camila@example.test", name: "Camila Rojas", providers: ["email"] };
const dimensions = {
  desktop: { width: 1440, height: 900 },
  movil: { width: 390, height: 844 },
};

const sourceId = "example-source";
const demoQuestion = {
  id: "example-percent", source_id: sourceId, number: "1",
  regions: [{ page: 1, bbox: [0, 0, 100, 100] }],
  stem: [{ type: "text", text: "En una librería, un cuaderno de $8.000 tiene un descuento del 25%. ¿Cuál es su nuevo precio?" }],
  options: ["$2.000", "$4.000", "$6.000", "$7.000"].map((value, i) => ({
    label: "ABCD"[i], blocks: [{ type: "text", text: value }],
  })),
  answer: { label: "C", status: "provisional", origin: "model", source_ref: null },
  explanation: { blocks: [{ type: "text", text: "El 25% de $8.000 es $2.000. El precio final es $6.000." }], status: "provisional" },
  fidelity: { status: "reviewed", review_ref: "example" },
  issues: ["Ejemplo ficticio para revisar la presentación del paquete."],
  curriculum: { eje: "Números", subeje: "Porcentaje", en_temario: "si" },
};
const demoPackage = {
  format: "paessed-benchmark", schema_version: "0.2.0", pipeline: "demo",
  run: { id: "example", cli: "test", model: "none", created_at: "2026-06-01" },
  exam: { id: "example", title: "Ensayo local de ejemplo", scope: "demo", expected_questions: [{ id: demoQuestion.id, source_id: sourceId, number: "1" }] },
  sources: [{ id: sourceId, name: "ejemplo.pdf", sha256: "a".repeat(64), page_count: 1, role: "exam" }],
  questions: [demoQuestion], assets: [], evidence: [],
};

function resultFixture() {
  const firstByUnit = new Map();
  for (const value of catalog.questions) {
    if (value.eligible && !firstByUnit.has(value.unitId)) firstByUnit.set(value.unitId, value);
  }
  return [...firstByUnit.values()];
}

async function seedDiagnostic(page, database, questions) {
  await page.evaluate(({ database, questions }) => new Promise((resolve, reject) => {
    const request = indexedDB.open(database, 1);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => request.transaction.abort();
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction("state", "readwrite");
      const store = transaction.objectStore("state");
      const read = store.get("current");
      read.onsuccess = () => {
        const state = read.result;
        if (!state) { transaction.abort(); return; }
        const date = "2026-06-01T12:00:00.000Z";
        const id = `${state.learnerId}:diagnostic`;
        const answers = Object.fromEntries(questions.map((q, i) => [q.id, i % 3 ? q.correct : q.correct === "A" ? "B" : "A"]));
        state.diagnostic = { id, questionIds: questions.map(q => q.id), answers, startedAt: date, completedAt: date };
        state.attempts = questions.map(q => ({
          id: `${id}:${q.id}`, sessionId: id, questionId: q.id, mode: "diagnostic", axisId: q.axisId, unitId: q.unitId,
          revision: q.revision, answer: answers[q.id], correct: answers[q.id] === q.correct, eligible: true, assisted: false, at: date,
        }));
        state.exposures = questions.map(q => ({ questionId: q.id, sessionId: id, mode: "diagnostic", at: date, assisted: false }));
        state.nodes = [];
        state.revision += 1;
        store.put(state, "current");
      };
      transaction.oncomplete = () => { db.close(); resolve(); };
      transaction.onabort = transaction.onerror = () => { db.close(); reject(transaction.error ?? new Error("Missing example learning state")); };
    };
  }), { database, questions });
}

async function replacePackageQuestion(page) {
  // The catalog has local-only editions. Show example text in their layout,
  // keeping the real paper controls and typography in the published images.
  await page.evaluate(question => {
    const stem = document.querySelector("[data-testid=learning-paper-stem]");
    if (!stem) return;
    const paragraph = document.createElement("p");
    paragraph.textContent = question.stem[0].text;
    stem.replaceChildren(paragraph);
    document.querySelectorAll("[data-option-content]").forEach((element, index) => {
      element.textContent = question.options[index]?.blocks[0].text ?? "Otra alternativa";
    });
  }, demoQuestion);
}

async function capture(page, id, format, theme, { exampleQuestion = false, fullPage = false } = {}) {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  if (exampleQuestion) await replacePackageQuestion(page);
  await page.locator("body").evaluate(() => window.scrollTo(0, 0));
  for (const view of ["actual", "propuesta"]) {
    await page.evaluate(view => document.documentElement.toggleAttribute("data-paessed-polish", view === "propuesta"), view);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${id} overflows at ${format} in ${view}`);
    const screenshot = await page.screenshot({ fullPage, caret: "initial" });
    await sharp(screenshot).webp({ quality: 80 }).toFile(fileURLToPath(new URL(`${id}-${format}-${theme}-${view}.webp`, output)));
  }
  await page.evaluate(() => document.documentElement.removeAttribute("data-paessed-polish"));
  console.log(`${format}/${theme} ${id}`);
}

async function renderSet(browser, format, theme) {
  const context = await browser.newContext({
    viewport: dimensions[format], deviceScaleFactor: 1, isMobile: format === "movil",
    hasTouch: format === "movil", reducedMotion: "reduce", colorScheme: theme === "oscuro" ? "dark" : "light",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  try {
    await page.routeWebSocket(url => ["/_next/hmr", "/_next/webpack-hmr"].includes(url.pathname), socket => {
      socket.connectToServer().onMessage(message => {
        // Next streams development app data through this socket as well.
        if (typeof message === "string" && /"type":"(?:reloadPage|turbopack-message)"/.test(message)) return;
        socket.send(message);
      });
    });
    await context.route(url => /^https?:$/.test(url.protocol) && url.origin !== origin, route => route.abort());
    const dev = await context.request.post(`${origin}/api/dev-mode`, { headers: { Origin: origin }, data: { enabled: true } });
    assert.ok(dev.ok(), "Start the app with PAESSED_DEV_MODE=true and matching APP_ORIGIN");
    await page.addInitScript(theme => {
      localStorage.setItem("paessed-dashboard-tour-seen", "1");
      localStorage.setItem("paessed-theme", theme === "oscuro" ? "dark" : "light");
      localStorage.setItem("paessed-question-paper-theme", theme === "oscuro" ? "dark" : "light");
      localStorage.setItem("paessed-playground-paper-theme", theme === "oscuro" ? "dark" : "light");
    }, theme);
    const failures = [];
    async function shot(id, pathname, ready, settings) {
      try {
        if (pathname) {
          const response = await page.goto(`${origin}${pathname}`);
          assert.equal(response.status(), 200);
          assert.equal(new URL(page.url()).pathname, pathname.split("?")[0]);
        }
        if (ready) await ready();
        await page.addStyleTag({ content: 'nextjs-portal, [aria-label="Herramientas de desarrollo"] { display: none !important; }' });
        await capture(page, id, format, theme, settings);
      } catch (error) {
        failures.push({ id, error: error.message, headings: await page.getByRole("heading").allTextContents() });
        console.error(`${format}/${theme} ${id}: ${error.message.split("\n")[0]}`);
      }
    }
    const heading = name => () => page.getByRole("heading", { name }).first().waitFor();
    const action = name => page.getByRole("button", { name, exact: true });
    const paper = () => page.getByTestId("learning-paper-stem").first().waitFor();
    await shot("portada", "/", heading(/Tu preparación empieza/), { fullPage: true });
    await shot("dialogo-acceso", null, async () => {
      await action("Ya tengo cuenta").click();
      await page.getByRole("dialog").waitFor();
    });
    await shot("acceso", "/login", heading("Inicia sesión"));
    await shot("registro", "/registro", async () => {
      await action("Continuar con correo").click();
      await page.getByLabel("Nombre", { exact: true }).waitFor();
    }, { fullPage: true });
    await shot("recuperar", "/auth/recover", heading(/Recupera tu acceso/));
    await shot("contrasena", "/visual-fixture-pulido", heading(/contraseña/i));
    await shot("reporte", "/reportar", heading(/Reportar/));
    await shot("diagnostico", "/diagnostico", heading("Diagnóstico M1"));
    await shot("diagnostico-pregunta", null, async () => {
      await action("Empezar diagnóstico").click();
      await paper();
    }, { exampleQuestion: true });
    const questions = resultFixture();
    await seedDiagnostic(page, "paessed-dev:paessed-learning", questions);
    await shot("diagnostico-resultado", "/diagnostico/resultado", heading("Tu punto de partida"), { fullPage: true });

    await page.evaluate(sample => {
      localStorage.setItem("paessed-dev:accounts-v1", JSON.stringify([sample]));
      localStorage.setItem("paessed-dev:active-account", sample.id);
      const prefix = `paessed-dev:paessed-account:${sample.id}:`;
      localStorage.setItem(prefix + "paessed-last-exam-v2", JSON.stringify({ correct: 48, wrong: 17, omitted: 0, score: 765, secondsLeft: 1780 }));
      const answers = Array.from({ length: 65 }, (_, index) => index === 64 ? null : index % 4);
      localStorage.setItem(prefix + "paessed-demo-exam-progress-v1", JSON.stringify({
        version: 1, questionIndex: 64, answers, flagged: answers.map(() => false), secondsLeft: 1800, strokesByQuestion: {}, savedAt: Date.now(),
      }));
    }, account);

    await page.goto(`${origin}/app/inicio`);
    await page.getByRole("heading", { name: /Camila/ }).waitFor();
    // A completed sample on both sides exercises the handoff choice UI.
    await seedDiagnostic(page, `paessed-dev:paessed-account-${account.id}-v3`, questions);
    await page.evaluate(({ id }) => new Promise((resolve, reject) => {
      const r = indexedDB.open(`paessed-dev:paessed-account-${id}-v3`, 1);
      r.onsuccess = () => {
        const db = r.result;
        const tx = db.transaction("state", "readwrite");
        const store = tx.objectStore("state");
        const read = store.get("current");
        read.onsuccess = () => {
          const state = read.result;
          state.diagnostic = null;
          store.put(state, "current");
        };
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
      r.onerror = () => reject(r.error);
    }), account);
    await shot("bienvenida", "/bienvenida", heading(/Sumar este diagnóstico/));

    // Incorporate the fixture locally to open the real practice route.
    const confirm = page.getByRole("button", { name: /incorporar respuestas/i }).first();
    if (await confirm.isVisible()) {
      await confirm.click();
      await page.waitForURL(url => url.pathname !== "/bienvenida");
    }
    await shot("dashboard", "/app/inicio", heading(/Camila/), { fullPage: true });
    await shot("aprender", "/app/aprender", async () => {
      await page.getByTestId("learning-route-node").first().waitFor();
    }, { fullPage: true });
    await shot("aprender-practica", null, async () => {
      await page.locator('[data-testid="learning-route-node"][data-state="current"]').first().click();
      await action("Comenzar nodo").click();
      await paper();
    }, { exampleQuestion: true });
    await shot("ensayos", "/app/ensayos?source=default", heading(/Tus ensayos/i), { fullPage: true });
    await shot("ensayos-local", "/app/ensayos?source=local", heading(/no tienes ensayos locales/i));
    await shot("ensayo-practica", "/app/ensayos/nuevo", paper);
    await shot("ensayo-resultado", "/app/ensayos/resultado", heading(/765 pts/), { fullPage: true });
    await shot("ensayo-default", catalog.exams[0].href, paper, { exampleQuestion: true });
    await shot("exam-importar", "/app/ensayos/importar", heading(/Añade un ensayo/i));

    await page.locator("input[type=file]").setInputFiles({
      name: "ejemplo.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(demoPackage)),
    });
    await action("Importar ensayo").click();
    await action("Importado").waitFor();
    const imported = await page.evaluate(() => new Promise((resolve, reject) => {
      const request = indexedDB.open("paessed-dev:paessed-local");
      request.onerror = () => reject(request.error);
      request.onupgradeneeded = () => request.transaction.abort();
      request.onsuccess = () => {
        const db = request.result;
        const read = db.transaction("imported-exams").objectStore("imported-exams").getAll();
        read.onsuccess = () => { db.close(); resolve(read.result[0]?.summary.id); };
        read.onerror = () => reject(read.error);
      };
    }));
    assert.ok(imported, "No fictional package imported");
    await shot("ensayo-importado", `/app/ensayos/importado/${imported}`, paper);
    await shot("auditoria", `/app/auditoria/paquetes/${imported}`, () => page.getByRole("region", { name: "Revisión del contenido del paquete" }).waitFor());
    await shot("playground", "/app/playground", heading(/Playground/), { fullPage: true });
    await shot("playground-practica", null, async () => {
      const start = page.locator("#playground-start-question");
      const option = start.locator("option").filter({ hasText: demoPackage.exam.title }).first();
      await start.selectOption(await option.getAttribute("value"));
      await action("Comenzar práctica").click();
      await paper();
    });
    await shot("perfil", "/app/perfil", heading(/Tu ritmo\. Tu progreso/), { fullPage: true });
    return failures;
  } finally {
    await context.close();
  }
}

await mkdir(output, { recursive: true });
// Mount the existing form in the local Next process for screenshots only.
const fixtureDirectory = new URL("../../app/visual-fixture-pulido/", import.meta.url);
const fixturePage = new URL("page.tsx", fixtureDirectory);
await mkdir(fixtureDirectory, { recursive: true });
await writeFile(fixturePage, `
import { notFound } from "next/navigation";
import { AuthForm } from "@/components/auth-form";

export default function VisualFixture() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <AuthForm mode="password" accountId="visual-fixture" />;
}
`, { flag: "wx" });

try {
  const browser = await chromium.launch({ channel: "chrome" });
  try {
    const selected = new Set(process.argv.slice(2));
    const combinations = Object.keys(dimensions).flatMap(format => ["claro", "oscuro"].map(theme => ({ format, theme })))
      .filter(({ format, theme }) => !selected.size || selected.has(`${format}/${theme}`));
    assert.ok(combinations.length, "Choose a valid format/theme combination");
    const results = await Promise.allSettled(combinations.map(({ format, theme }) => renderSet(browser, format, theme)));
    for (const result of results) {
      if (result.status === "rejected") console.error(result.reason);
      else if (result.value.length) console.error(result.value);
    }
    if (results.some(result => result.status === "rejected" || result.value.length)) process.exitCode = 1;
  } finally {
    await browser.close();
  }
} finally {
  await unlink(fixturePage);
}
