// Let local browser suites exercise the normal client against controlled API
// responses while the server uses the existing local-only entry gate.
async function enableLocalApp(page, baseURL, { showQuestionTour = false } = {}) {
  const origin = new URL(baseURL).origin;
  if (!["127.0.0.1", "localhost"].includes(new URL(origin).hostname)) {
    throw new Error("This fixture requires a local server.");
  }
  const response = await page.request.post(`${origin}/api/dev-mode`, { headers: { Origin: origin }, data: { enabled: true } });
  if (!response.ok()) throw new Error("Start the local app with PAESSED_DEV_MODE=true and matching APP_ORIGIN.");
  await page.addInitScript(({ showQuestionTour }) => {
    Object.defineProperty(window, "__PAESSED_DEV_SANDBOX__", { get: () => undefined, set: () => {} });
    if (!showQuestionTour) {
      localStorage.setItem('paessed-question-tour-v1-mobile', '1');
      localStorage.setItem('paessed-question-tour-v1-desktop', '1');
    }
  }, { showQuestionTour });
}

module.exports = { enableLocalApp };
