import { getDb } from "@/db";
import { newsletterSubscribers } from "@/db/schema";
import { enforceSameOrigin, errorResponse, normalizeEmail } from "@/lib/errors";
import { enforceRateLimit, requestIp } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    await enforceRateLimit(`newsletter:${requestIp(request)}`, 5, 60 * 60);
    const contentType = request.headers.get("content-type") ?? "";
    const payload = contentType.includes("application/json")
      ? await request.json() as Record<string, unknown>
      : Object.fromEntries((await request.formData()).entries());
    const email = normalizeEmail(payload.email);
    const db = await getDb();
    await db.insert(newsletterSubscribers).values({ email }).onConflictDoUpdate({ target: newsletterSubscribers.email, set: { active: true } });
    if (!contentType.includes("application/json")) return Response.redirect(new URL("/?newsletter=ok", request.url), 303);
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
