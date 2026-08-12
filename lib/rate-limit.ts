import { AppError } from "./errors";
import { getRawDb } from "@/db";

export async function enforceRateLimit(key: string, limit: number, windowSeconds: number): Promise<void> {
  const db = await getRawDb();
  const now = Date.now();
  const row = await db.prepare("SELECT count, window_start AS windowStart FROM rate_limits WHERE key = ?")
    .bind(key)
    .first<{ count: number; windowStart: string }>();

  if (!row || now - new Date(row.windowStart).getTime() >= windowSeconds * 1000) {
    await db.prepare(
      "INSERT INTO rate_limits (key, count, window_start) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = 1, window_start = excluded.window_start",
    ).bind(key, new Date(now).toISOString()).run();
    return;
  }

  if (row.count >= limit) {
    throw new AppError(429, "Muitas tentativas. Aguarde alguns minutos e tente novamente.", "RATE_LIMITED");
  }
  await db.prepare("UPDATE rate_limits SET count = count + 1 WHERE key = ?").bind(key).run();
}

export function requestIp(request: Request): string {
  return request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}
