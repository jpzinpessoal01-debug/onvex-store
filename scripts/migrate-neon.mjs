import { readFile } from "node:fs/promises";
import { Pool } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_PRISMA_URL ?? process.env.POSTGRES_URL;
if (!connectionString) {
  console.log("Neon migration skipped: no PostgreSQL connection string configured.");
  process.exit(0);
}

const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 15_000 });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query(await readFile(new URL("./neon-schema.sql", import.meta.url), "utf8"));
  await client.query(await readFile(new URL("./neon-seed.sql", import.meta.url), "utf8"));
  await client.query(await readFile(new URL("./neon-media-fix.sql", import.meta.url), "utf8"));
  await client.query(await readFile(new URL("./neon-price-fix.sql", import.meta.url), "utf8"));

  const adminEmails = [
    process.env.SUPER_ADMIN_EMAIL,
    ...(process.env.ADMIN_EMAILS ?? "").split(","),
  ].map((email) => email?.trim().toLowerCase()).filter(Boolean);
  for (const email of adminEmails) {
    await client.query(
      `INSERT INTO users (email, name, role, active, email_verified_at)
       VALUES ($1, $2, $3, 1, CURRENT_TIMESTAMP::text)
       ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, active = 1, updated_at = CURRENT_TIMESTAMP::text`,
      [email, email === process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase() ? "ONVEX Admin" : "ONVEX Manager", email === process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase() ? "SUPER_ADMIN" : "ADMIN"],
    );
  }

  await client.query("COMMIT");
  console.log("Neon schema and ONVEX catalog are ready.");
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined);
  console.error("Neon migration failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
