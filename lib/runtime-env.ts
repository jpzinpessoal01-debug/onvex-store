/**
 * Returns server-only configuration in both runtimes used by ONVEX:
 * Cloudflare Sites (bindings in `cloudflare:workers`) and Vercel/Next.js
 * (ordinary process environment variables).
 */
export async function getRuntimeEnv<T extends Record<string, unknown>>(): Promise<T> {
  if (typeof process !== "undefined" && (process.env.VERCEL || process.env.DATABASE_URL || process.env.POSTGRES_URL)) {
    return process.env as unknown as T;
  }

  try {
    const runtime = await import("cloudflare:workers");
    return runtime.env as unknown as T;
  } catch {
    return (typeof process !== "undefined" ? process.env : {}) as unknown as T;
  }
}
