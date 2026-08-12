import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { adminSessionCookie, createAdminSessionToken, verifyAdminCredentials } from "@/lib/admin-session";

function safeReturnTo(value: FormDataEntryValue | null): string {
  const raw = typeof value === "string" ? value : "/admin";
  return raw.startsWith("/admin") && !raw.startsWith("//") ? raw : "/admin";
}

export async function POST(request: Request) {
  const form = await request.formData();
  const username = String(form.get("username") ?? "");
  const password = String(form.get("password") ?? "");
  const returnTo = safeReturnTo(form.get("returnTo"));

  if (!(await verifyAdminCredentials(username, password))) {
    return NextResponse.redirect(new URL(`/admin/login?error=invalid&returnTo=${encodeURIComponent(returnTo)}`, request.url), 303);
  }

  const db = await getDb();
  const email = "admin@onvex.local";
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  let user;
  if (existing) {
    [user] = await db.update(users).set({ name: "ONVEX Admin", role: "SUPER_ADMIN", active: true }).where(eq(users.id, existing.id)).returning();
  } else {
    [user] = await db.insert(users).values({ email, name: "ONVEX Admin", role: "SUPER_ADMIN", active: true }).returning();
  }

  const token = await createAdminSessionToken({ id: user.id, email: user.email, name: user.name, role: "SUPER_ADMIN", phone: user.phone ?? null, cpf: user.cpf ?? null });
  const response = NextResponse.redirect(new URL(returnTo, request.url), 303);
  response.headers.append("set-cookie", adminSessionCookie(token));
  return response;
}
