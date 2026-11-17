import { readFileSync } from "node:fs";
import { checkServerIdentity, type ConnectionOptions } from "node:tls";

/** Explicit TLS options override permissive sslmode URL defaults in Postgres.js. */
export function databaseTlsOptions(env: Record<string, string | undefined> = process.env): ConnectionOptions | false {
  const url = new URL(env.DATABASE_URL ?? "");
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  const inline = env.DATABASE_SSL_CA?.replace(/\\n/g, "\n");
  const ca = inline || (env.DATABASE_SSL_CA_PATH ? readFileSync(env.DATABASE_SSL_CA_PATH, "utf8") : undefined);
  if (local && !ca && !url.searchParams.has("sslmode")) return false;
  return { ...(ca ? { ca } : {}), rejectUnauthorized: true, minVersion: "TLSv1.2", servername: url.hostname,
    checkServerIdentity: (_host, certificate) => checkServerIdentity(url.hostname, certificate) };
}
