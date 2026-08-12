import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";
import { createNeonD1Compat, type NeonD1Compat } from "@/lib/neon-d1";

let neonDatabase: NeonD1Compat | null = null;

function configuredPostgresUrl(): string | null {
  if (typeof process === "undefined") return null;
  return process.env.DATABASE_URL
    ?? process.env.POSTGRES_PRISMA_URL
    ?? process.env.POSTGRES_URL
    ?? null;
}

export async function getDb() {
  const raw = await getRawDb();
  return drizzle(raw, { schema });
}

export async function getRawDb(): Promise<D1Database> {
  const connectionString = configuredPostgresUrl();
  if (connectionString) {
    neonDatabase ??= await createNeonD1Compat(connectionString);
    return neonDatabase as unknown as D1Database;
  }

  const runtime = await import("cloudflare:workers");
  const binding = (runtime.env as unknown as { DB?: D1Database }).DB;
  if (!binding) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }
  return binding;
}
