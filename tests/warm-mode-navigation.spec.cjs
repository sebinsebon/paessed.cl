const { test, expect } = require("@playwright/test");
const { enableLocalApp } = require("./local-app-fixture.cjs");

const accountId = "11111111-1111-4111-8111-111111111111";
const emptySync = {
  revision: 0, generation: 0, catalogRevision: "gold-0.7-sync-1",
  acknowledgements: [], changes: [], conflicts: [], hasMore: false, cursor: 0,
};
const modes = [
  ["inicio", /¡Hola, Cuenta Uno/],
  ["aprender", /^Aprender$/],
  ["ensayos", /^Tus ensayos$/],
  ["playground", /^Playground$/],
  ["perfil", /^Tu ritmo\. Tu progreso\.$/],
];

for (const width of [390, 1440]) {
  test("volver a los cinco modos visitados no repite el skeleton a " + width + " px", async ({ page, baseURL }) => {
    await page.setViewportSize({ width, height: 900 });
    await enableLocalApp(page, baseURL);
    await page.route("**/api/auth/session", route => route.fulfill({ json: {
      configured: true, user: { id: accountId, providers: ["email"] },
      profile: { displayName: "Cuenta Uno", timezone: "America/Santiago" },
    } }));
    await page.route("**/api/sync?**", route => route.fulfill({ json: emptySync }));
    // An intentionally slow RSC round trip must not force a skeleton on revisit.
    await page.route(url => new URL(url).searchParams.has("_rsc"), async route => {
      await new Promise(resolve => setTimeout(resolve, 450));
      await route.continue();
    });

    await page.goto("/app/inicio");
    await expect(page.getByRole("heading", { name: /¡Hola, Cuenta Uno/ })).toBeVisible();
    const clickMode = async (mode, heading) => {
      await page.locator('.paessed-sidebar-nav-link[href="/app/' + mode + '"], .paessed-mobile-nav-link[href="/app/' + mode + '"]')
        .filter({ visible: true }).first().click();
      await expect(page).toHaveURL(new RegExp("/app/" + mode + "$"));
      await expect(page.locator("main h1:visible").first()).toHaveText(heading);
      await expect(page.locator("main [data-loading-placeholder]:visible")).toHaveCount(0);
    };

    // First entry may genuinely need to load. This regression is about warm navigation.
    for (const [mode, heading] of modes) await clickMode(mode, heading);

    await page.evaluate(() => {
      window.modeWarmSkeletonFrames = 0;
      const scan = () => {
        if ([...document.querySelectorAll("main [data-loading-placeholder]")].some(element =>
          element.getClientRects().length > 0 && getComputedStyle(element).visibility === "visible"
        )) window.modeWarmSkeletonFrames++;
        window.modeWarmSkeletonObserver = requestAnimationFrame(scan);
      };
      window.modeWarmSkeletonObserver = requestAnimationFrame(scan);
    });
    try {
      for (const [mode, heading] of modes) {
        await clickMode(mode, heading);
      }
      expect(await page.evaluate(() => window.modeWarmSkeletonFrames)).toBe(0);
    } finally {
      await page.evaluate(() => cancelAnimationFrame(window.modeWarmSkeletonObserver));
    }
  });
}
