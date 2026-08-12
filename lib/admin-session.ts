import { cookies } from "next/headers";
import { getRuntimeEnv } from "./runtime-env";
import type { AppUser } from "./types";

const COOKIE = "onvex_admin_session";
const MAX_AGE = 60 * 60 * 12;
const ADMIN_USERNAME = "onvexadmin";
const ADMIN_PASSWORD_SHA256 = "02d9fde93a5c33f95c124cba99c46e682fab4524db0fc0ec0a67e58ed8928677";

type RuntimeEnv = {
  AUTH_SECRET?: string;
  DATABASE_URL?: string;
  POSTGRES_PRISMA_URL?: string;
  POSTGRES_URL?: string;
};

type Payload = {
  id: number;
  email: string;
  name: string;
  role: "SUPER_ADMIN";
  exp: number;
};

async function secret(): Promise<string> {
  const env = await getRuntimeEnv<RuntimeEnv>();
  const value = env.AUTH_SECRET?.trim() || env.DATABASE_URL?.trim() || env.POSTGRES_PRISMA_URL?.trim() || env.POSTGRES_URL?.trim();
  if (!value) throw new Error("Admin session secret is not configured.");
  return value;
}

export async function verifyAdminCredentials(username: string, password: string): Promise<boolean> {
  if (username.trim().toLowerCase() !== ADMIN_USERNAME) return false;
  return (await sha256(password)) === ADMIN_PASSWORD_SHA256;
}

export async function createAdminSessionToken(user: AppUser): Promise<string> {
  const payload: Payload = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: "SUPER_ADMIN",
    exp: Math.floor(Date.now() / 1000) + MAX_AGE,
  };
  const encoded = encode(JSON.stringify(payload));
  return `${encoded}.${await sign(encoded, await secret())}`;
}

export async function getAdminSessionUser(): Promise<AppUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const payload = await verify(token);
  if (!payload) return null;
  return { id: payload.id, email: payload.email, name: payload.name, role: "SUPER_ADMIN", phone: null, cpf: null };
}

export function adminSessionCookie(token: string): string {
  return `${COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearAdminSessionCookie(): string {
  return `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

async function verify(token: string): Promise<Payload | null> {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  try {
    const expected = await sign(encoded, await secret());
    if (signature !== expected) return null;
    const payload = JSON.parse(decode(encoded)) as Payload;
    if (!payload.id || !payload.email || payload.role !== "SUPER_ADMIN" || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

async function sign(value: string, keyValue: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(keyValue), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))));
}

async function sha256(value: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function encode(value: string): string { return toBase64Url(new TextEncoder().encode(value)); }
function decode(value: string): string { return new TextDecoder().decode(fromBase64Url(value)); }
function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
