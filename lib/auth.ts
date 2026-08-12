import { and, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { getAuthenticatedUser } from "@/app/chatgpt-auth";
import { AppError } from "./errors";
import type { AppUser, Role } from "./types";
import { canAccessAdmin } from "./permissions";
import { sendTransactionalEmail } from "./email";
import { getRuntimeEnv } from "./runtime-env";

type RuntimeEnv = {
  SUPER_ADMIN_EMAIL?: string;
  ADMIN_EMAILS?: string;
};

async function configuredRole(email: string): Promise<Role> {
  const runtime = await getRuntimeEnv<RuntimeEnv>();
  if (runtime.SUPER_ADMIN_EMAIL?.trim().toLowerCase() === email) return "SUPER_ADMIN";
  const admins = (runtime.ADMIN_EMAILS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email) ? "ADMIN" : "CUSTOMER";
}

export async function getCurrentAppUser(): Promise<AppUser | null> {
  const identity = await getAuthenticatedUser();
  if (!identity) return null;
  return upsertAppUser(identity);
}

export async function upsertAppUser(identity: { email: string; displayName: string }): Promise<AppUser> {
  const email = identity.email.trim().toLowerCase();
  const db = await getDb();
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const desiredRole = await configuredRole(email);

  if (existing) {
    const role = desiredRole === "CUSTOMER" ? existing.role : desiredRole;
    const [updated] = await db
      .update(users)
      .set({
        name: identity.displayName,
        role,
        lastLoginAt: sql`CURRENT_TIMESTAMP`,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(and(eq(users.id, existing.id), eq(users.active, true)))
      .returning();
    if (!updated) throw new AppError(403, "Esta conta está desativada.", "ACCOUNT_DISABLED");
    return updated as AppUser;
  }

  const [created] = await db
    .insert(users)
    .values({
      email,
      name: identity.displayName,
      role: desiredRole,
      emailVerifiedAt: sql`CURRENT_TIMESTAMP`,
      lastLoginAt: sql`CURRENT_TIMESTAMP`,
    })
    .returning();
  void sendTransactionalEmail(email, "WELCOME", { name: identity.displayName, actionUrl: "/loja" }).catch(() => false);
  return created as AppUser;
}

export async function requireUserApi(): Promise<AppUser> {
  const user = await getCurrentAppUser();
  if (!user) throw new AppError(401, "Entre na sua conta para continuar.", "AUTH_REQUIRED");
  return user;
}

export async function requireAdminApi(superAdminOnly = false): Promise<AppUser> {
  const user = await requireUserApi();
  const allowed = canAccessAdmin(user.role, superAdminOnly);
  if (!allowed) throw new AppError(403, "Você não tem permissão para esta ação.", "FORBIDDEN");
  return user;
}

export async function requireAdminPage(returnTo: string): Promise<AppUser> {
  const user = await getCurrentAppUser();
  if (!user) redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  if (!canAccessAdmin(user.role)) redirect("/minha-conta?acesso=negado");
  return user;
}
