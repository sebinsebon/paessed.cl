import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";

export function localSupabaseOrigin(value) {
  const url = new URL(value);
  if (url.protocol !== "http:" || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("Esta comprobación solo admite un origen HTTP de Supabase local en loopback.");
  }
  return url.origin;
}

export async function verifyLocalSupabase(environment = process.env, request = fetch) {
  const origin = localSupabaseOrigin(environment.LOCAL_SUPABASE_URL ?? environment.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321");
  const key = environment.LOCAL_SUPABASE_PUBLISHABLE_KEY ?? environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!key) throw new Error("Falta la clave pública del Supabase local.");
  const scopes = [{ name: "anon", token: null }];
  if (environment.LOCAL_TEST_ACCESS_TOKEN) scopes.push({ name: "authenticated", token: environment.LOCAL_TEST_ACCESS_TOKEN });
  const results = [];
  for (const scope of scopes) {
    const headers = { apikey: key, ...(scope.token ? { Authorization: `Bearer ${scope.token}` } : {}) };
    const send = async (path, options = {}) => {
      const response = await request(`${origin}${path}`, { ...options, headers: { ...headers, ...options.headers }, signal: AbortSignal.timeout(5000) });
      let body;
      try { body = await response.json(); } catch { body = null; }
      return { response, body };
    };
    if (scope.token) {
      const { response, body } = await send("/auth/v1/user");
      if (!response.ok || !body?.id) throw new Error("LOCAL_TEST_ACCESS_TOKEN no corresponde a una sesión local válida.");
    }
    for (const probe of [
      { name: "PostgREST tabla privada", path: "/rest/v1/profiles?select=owner_id", options: { headers: { "Accept-Profile": "paessed" } }, expected: [403, 406] },
      { name: "RPC privada", path: "/rest/v1/rpc/consume_limit", options: { method: "POST", headers: { "Content-Profile": "paessed", "Content-Type": "application/json" }, body: JSON.stringify({ p_key: "probe", p_limit: 1, p_window: 60 }) }, expected: [403, 406] },
      { name: "RPC pública inexistente", path: "/rest/v1/rpc/consume_limit", options: { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ p_key: "probe", p_limit: 1, p_window: 60 }) }, expected: [403, 404] },
    ]) {
      const { response } = await send(probe.path, probe.options);
      if (!probe.expected.includes(response.status)) throw new Error(`${scope.name}: ${probe.name} no rechazó el acceso como se esperaba (HTTP ${response.status}).`);
      results.push({ scope: scope.name, probe: probe.name, status: response.status });
    }
    const buckets = await send("/storage/v1/bucket");
    if (buckets.response.ok && (!Array.isArray(buckets.body) || buckets.body.length)) throw new Error("El Supabase local contiene buckets; revisar antes de probar la prohibición de subidas.");
    if (!buckets.response.ok && ![401, 403].includes(buckets.response.status)) throw new Error(`Storage no disponible (HTTP ${buckets.response.status}).`);

    const bucketId = `paessed-permission-probe-${randomUUID()}`;
    const creation = await send("/storage/v1/bucket", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: bucketId, name: bucketId, public: false }) });
    if (creation.response.ok) {
      // A failed security check must not leave its test resource behind when the same role can remove it.
      await send(`/storage/v1/bucket/${bucketId}`, { method: "DELETE" });
      throw new Error(`${scope.name}: la clave pública permitió crear el bucket de prueba ${bucketId}; se intentó eliminarlo.`);
    }
    const permissionDenied = [401, 403].includes(creation.response.status) || creation.response.status === 400 && /permission|authorized|row.level|owner|denied/i.test(JSON.stringify(creation.body));
    if (!permissionDenied) throw new Error(`${scope.name}: el rechazo de Storage no demuestra falta de permisos (HTTP ${creation.response.status}).`);
    results.push({ scope: scope.name, probe: "Storage sin creación de buckets", status: creation.response.status });
    const upload = await send(`/storage/v1/object/${bucketId}/probe.txt`, { method: "POST", headers: { "Content-Type": "text/plain" }, body: "local permission probe" });
    if (![400, 401, 403, 404].includes(upload.response.status)) throw new Error(`${scope.name}: Storage no rechazó la escritura (HTTP ${upload.response.status}).`);
    results.push({ scope: scope.name, probe: "Storage sin subida", status: upload.response.status });
  }
  return { origin, results, authenticatedTested: scopes.length === 2 };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const report = await verifyLocalSupabase();
    for (const result of report.results) process.stdout.write(`${result.scope}: ${result.probe}: HTTP ${result.status}\n`);
    if (!report.authenticatedTested) process.stdout.write("Pendiente: repetir con LOCAL_TEST_ACCESS_TOKEN de un usuario local verificado.\n");
  } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}
