const { chromium } = require("playwright");
const { enableLocalApp } = require("../tests/local-app-fixture.cjs");

const displayName = "Cuenta Auditoria";
const account = {
  configured: true,
  user: { id: "11111111-1111-4111-8111-111111111111", providers: ["email"] },
  profile: { displayName, timezone: "America/Santiago" },
};
const sync = {
  revision: 0, generation: 0, catalogRevision: "gold-0.7-sync-1",
  acknowledgements: [], changes: [], conflicts: [], hasMore: false, cursor: 0,
};
const delayMs = 450;
const coldSamples = 12;
const warmSamples = 30;

async function withPage(browser, origin, width, work) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
  try {
    const page = await context.newPage();
    await enableLocalApp(page, origin);
    let sessions = 0;
    await page.route("**/api/**", async route => {
      const path = new URL(route.request().url()).pathname;
      if (path !== "/api/auth/session" && path !== "/api/sync") return route.abort();
      if (path === "/api/auth/session") sessions++;
      await new Promise(resolve => setTimeout(resolve, delayMs));
      return route.fulfill({ json: path === "/api/auth/session" ? account : sync });
    });
    await page.addInitScript(name => {
      const visible = element => element?.getClientRects().length > 0 && getComputedStyle(element).visibility === "visible";
      window.observeSessionPresentation = (mode, start, pathname) => new Promise((resolve, reject) => {
        let safe;
        function frame() {
          const elapsed = Math.round(performance.now() - start);
          if (location.pathname === pathname) {
            if (mode === "profile") {
              const input = document.querySelector('[aria-labelledby="account-title"] input[autocomplete="name"]');
              if (visible(input) && input.value === name) return resolve({ personalizedMs: elapsed });
            } else {
              const heading = document.querySelector("main h1");
              const actions = [...document.querySelectorAll('main a[href="/app/ensayos"]')];
              if (visible(heading) && actions.some(action => visible(action) && action.textContent.includes("Hacer un ensayo"))) safe ??= elapsed;
              if (safe !== undefined && heading?.textContent.includes(name)) return resolve({ safeMs: safe, personalizedMs: elapsed });
            }
          }
          if (elapsed >= 12_000) return reject(new Error("No apareció el contenido de " + pathname));
          requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      });
      if (location.pathname === "/app/inicio") window.coldSessionPresentation = window.observeSessionPresentation("home", 0, "/app/inicio");
    }, displayName);
    return await work(page, () => sessions);
  } finally {
    await context.close();
  }
}

async function measureCold(browser, origin, width) {
  const rows = [];
  for (let index = 0; index < coldSamples; index++) {
    rows.push(await withPage(browser, origin, width, async (page, count) => {
      await page.goto(origin + "/app/inicio", { waitUntil: "domcontentloaded" });
      const timing = await page.evaluate(() => window.coldSessionPresentation);
      return { ...timing, sessionGets: count() };
    }));
  }
  return rows;
}

async function navigate(page, path, mode) {
  const link = page.locator(`a[href="${path}"]:visible`).first();
  return link.evaluate((element, target) => {
    const observation = window.observeSessionPresentation(target, performance.now(), element.pathname);
    element.click();
    return observation;
  }, mode);
}

async function measureWarm(browser, origin, width) {
  return withPage(browser, origin, width, async (page, count) => {
    const home = [], profile = [];
    await page.goto(origin + "/app/ensayos");
    for (let index = 0; index <= warmSamples; index++) {
      await page.getByRole("heading", { name: "Tus ensayos", exact: true }).waitFor();
      const beforeHome = count();
      const homeTiming = await navigate(page, "/app/inicio", "home");
      await page.getByRole("button", { name: "Abrir perfil" }).filter({ visible: true }).first().click();
      const beforeProfile = count();
      const profileTiming = await navigate(page, "/app/perfil", "profile");
      if (index) {
        home.push({ ...homeTiming, sessionGets: beforeProfile - beforeHome });
        profile.push({ ...profileTiming, sessionGets: count() - beforeProfile });
      }
      await page.locator('a[href="/app/ensayos"]:visible').first().click();
    }
    return { home, profile };
  });
}

function summarize(rows) {
  return Object.fromEntries(Object.keys(rows[0]).map(key => {
    const values = rows.map(row => row[key]).sort((a, b) => a - b);
    const middle = Math.floor(values.length / 2);
    const p50 = values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
    return [key, { p50, p95: values[Math.ceil(values.length * .95) - 1] }];
  }));
}

(async () => {
  const [main, candidate] = process.argv.slice(2);
  if (!main || !candidate) throw new Error("Provide both local origins.");
  const browser = await chromium.launch();
  try {
    for (const width of [1440, 390]) {
      for (const [build, origin] of [["main", main], ["candidate", candidate]]) {
        const cold = await measureCold(browser, origin, width);
        const { home, profile } = await measureWarm(browser, origin, width);
        for (const [scenario, rows] of Object.entries({ cold, home, profile })) {
          console.log(JSON.stringify({ build, width, delayMs, scenario, samples: rows.length, summary: summarize(rows), rows }));
        }
      }
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
