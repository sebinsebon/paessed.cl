const { chromium } = require("playwright");
const { enableLocalApp } = require("../tests/local-app-fixture.cjs");

const account = {
  configured: true,
  user: { id: "11111111-1111-4111-8111-111111111111", providers: ["email"] },
  profile: { displayName: "Auditoria", timezone: "America/Santiago" },
};
const sync = {
  revision: 0, generation: 0, catalogRevision: "gold-0.7-sync-1",
  acknowledgements: [], changes: [], conflicts: [], hasMore: false, cursor: 0,
};

async function measure(browser, origin, width, delay) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  try {
    const page = await context.newPage();
    await enableLocalApp(page, origin);
    await page.route("**/api/**", async route => {
      const path = new URL(route.request().url()).pathname;
      if (path === "/api/auth/session") {
        if (delay) await new Promise(resolve => setTimeout(resolve, delay));
        return route.fulfill({ json: account });
      }
      if (path === "/api/sync") return route.fulfill({ json: sync });
      return route.abort();
    });
    await page.goto(origin + "/app/ensayos");
    const observations = [];
    for (let i = 0; i < 31; i++) {
      await page.getByRole("heading", { name: "Tus ensayos", exact: true }).waitFor();
      const inicio = page.locator('a[href="/app/inicio"]:visible').first();
      const observed = await inicio.evaluate(link => new Promise((resolve, reject) => {
        const start = performance.now();
        const times = { url: null, heading: null, useful: null, name: null };
        const visible = element => element?.getBoundingClientRect().height && getComputedStyle(element).visibility === "visible";
        function frame() {
          const elapsed = Math.round(performance.now() - start);
          if (location.pathname === link.pathname) {
            times.url ??= elapsed;
            const heading = document.querySelector("main h1");
            if (visible(heading) && heading.textContent.startsWith("¡Hola")) {
              times.heading ??= elapsed;
              const actions = document.querySelectorAll('main a[href="/app/ensayos"]');
              if ([...actions].some(action => visible(action) && action.textContent.includes("Hacer un ensayo"))) {
                times.useful ??= elapsed;
              }
              if (heading.textContent.includes("Auditoria")) times.name ??= elapsed;
            }
            if (times.name !== null && times.useful !== null) return resolve(times);
          }
          if (elapsed > 8000) return reject(new Error("Inicio did not settle"));
          requestAnimationFrame(frame);
        }
        link.click();
        requestAnimationFrame(frame);
      }));
      if (i > 0) observations.push(observed);
      await page.locator('a[href="/app/ensayos"]:visible').first().evaluate(link => link.click());
    }
    return observations;
  } finally {
    await context.close();
  }
}

function summarize(observations) {
  return Object.fromEntries(Object.keys(observations[0]).map(key => {
    const times = observations.map(row => row[key]).sort((a, b) => a - b);
    return [key, { p50: (times[14] + times[15]) / 2, p95: times[28] }];
  }));
}

(async () => {
  const [baseline, candidate] = process.argv.slice(2);
  if (!baseline || !candidate) throw new Error("Provide the local baseline and candidate origins.");
  const browser = await chromium.launch();
  try {
    for (const [width, delay] of [[1440, 450], [1440, 0], [390, 450]]) {
      const builds = [["baseline", baseline], ["candidate", candidate]];
      if (!delay) builds.reverse();
      for (const [build, origin] of builds) {
        const observations = await measure(browser, origin, width, delay);
        console.log(JSON.stringify({ build, width, delay, summary: summarize(observations), observations }));
      }
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
