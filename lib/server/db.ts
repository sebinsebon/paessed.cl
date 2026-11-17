import postgres from "postgres";
import { HttpError } from "./http.ts";
import { databaseTlsOptions } from "./db-tls.ts";

let connection: ReturnType<typeof postgres> | undefined;
/** Privileged server connection only. Never import this module in a client component. */
export function db(): ReturnType<typeof postgres> {
  if (typeof window !== "undefined") throw new Error("Servidor únicamente.");
  if (!process.env.DATABASE_URL) throw new HttpError(503, "La sincronización aún no está configurada. Puedes seguir trabajando localmente.");
  connection ??= postgres(process.env.DATABASE_URL, { max: 3, prepare: false, ssl: databaseTlsOptions(), idle_timeout: 20, connect_timeout: 10, onnotice: () => undefined });
  return connection;
}
export type Query = <T extends Record<string, unknown> = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<T[]>;
export type Database = { query: Query; transaction: <T>(work: (query: Query) => Promise<T>) => Promise<T> };
export function database(): Database {
  const sql = db();
  const query: Query = async (text, params = []) => await sql.unsafe(text, params as never[]) as never;
  return { query, transaction: async work => await sql.begin(async tx => await work(async (text, params = []) => await tx.unsafe(text, params as never[]) as never)) as never };
}
