import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { permitsBackend } from "@/lib/server/deployment-backend";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  response.headers.set("Cache-Control", "private, no-store");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!permitsBackend() || !url || !key) return response;
  const client = createServerClient(url, key, {
    auth: { flowType: "pkce", detectSessionInUrl: false },
    cookieOptions: { httpOnly: true, sameSite: "lax", secure: process.env.APP_ORIGIN?.startsWith("https://"), path: "/" },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values, headers) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
        response.headers.set("Cache-Control", "private, no-store");
      },
    },
  });
  // Refresh cookies here; every protected API independently verifies the user and session.
  try { await client.auth.getUser(); } catch { /* Offline work remains available; APIs validate before every remote action. */ }
  return response;
}
export const config = { matcher: ["/", "/login", "/registro", "/bienvenida", "/diagnostico/:path*", "/app/:path*", "/auth/password"] };
