import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { requireUserApi } from "@/lib/auth";
import { cleanText, enforceSameOrigin, errorResponse, optionalText } from "@/lib/errors";

export async function PATCH(request: Request) {
  try {
    enforceSameOrigin(request);
    const user = await requireUserApi();
    const payload = await request.json() as Record<string, unknown>;
    const db = await getDb();
    const [updated] = await db.update(users).set({ name: cleanText(payload.name, "Nome", 150), phone: optionalText(payload.phone, 30), cpf: optionalText(payload.cpf, 20), updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(users.id, user.id)).returning();
    return Response.json({ user: updated });
  } catch (error) { return errorResponse(error); }
}

