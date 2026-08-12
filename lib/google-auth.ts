import { cookies } from "next/headers";
import { getRuntimeEnv } from "./runtime-env";

export const GOOGLE_SESSION_COOKIE = "onvex_google_session";
export const GOOGLE_STATE_COOKIE = "onvex_google_state";
export const GOOGLE_RETURN_COOKIE = "onvex_google_return";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

type GoogleRuntimeEnv = {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_REDIRECT_URI?: string;
  AUTH_SECRET?: string;
};

type GoogleSessionPayload = {
  provider: "google";
  email: string;
  name: string;
  exp: number;
};

export async function getGoogleRuntimeEnv(): Promise<GoogleRuntimeEnv> {
  return getRuntimeEnv<GoogleRuntimeEnv>();
}

export async function googleAuthConfigured(): Promise<boolean> {
  const runtime = await getGoogleRuntimeEnv();
  return Boolean(runtime.GOOGLE_CLIENT_ID?.trim() && runtime.GOOGLE_CLIENT_SECRET?.trim() && getAuthSecret(runtime));
}

export function getAuthSecret(runtime: GoogleRuntimeEnv): string | null {
  const secret = runtime.AUTH_SECRET?.trim() || runtime.GOOGLE_CLIENT_SECRET?.trim();
  return secret || null;
}

export function safeReturnTo(value: string | null | undefined, fallback = "/minha-conta"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  try {
    const url = new URL(value, "https://onvex.local");
    if (url.origin !== "https://onvex.local") return fallback;
    if (url.pathname.startsWith("/api/auth/google")) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export function googleSignInPath(returnTo: string): string {
  return `/api/auth/google?return_to=${encodeURIComponent(safeReturnTo(returnTo))}`;
}

export async function getGoogleSessionUser(): Promise<{ displayName: string; email: string; fullName: string | null } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(GOOGLE_SESSION_COOKIE)?.value;
  if (!token) return null;

  const runtime = await getGoogleRuntimeEnv();
  const secret = getAuthSecret(runtime);
  if (!secret) return null;
  const payload = await verifySessionToken(token, secret);
  if (!payload) return null;
  return { displayName: payload.name, email: payload.email, fullName: payload.name };
}

export async function createGoogleSessionToken(input: { email: string; name: string }): Promise<string> {
  const runtime = await getGoogleRuntimeEnv();
  const secret = getAuthSecret(runtime);
  if (!secret) throw new Error("AUTH_SECRET is not configured.");
  const payload: GoogleSessionPayload = {
    provider: "google",
    email: input.email.trim().toLowerCase(),
    name: input.name.trim().slice(0, 160) || input.email.trim(),
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
  };
  const encoded = encodeText(JSON.stringify(payload));
  return `${encoded}.${await sign(encoded, secret)}`;
}

export function sessionCookie(token: string): string {
  return `${GOOGLE_SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${SESSION_MAX_AGE}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearGoogleSessionCookie(): string {
  return `${GOOGLE_SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

export function clearGoogleOAuthCookies(): string[] {
  return [
    `${GOOGLE_STATE_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
    `${GOOGLE_RETURN_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
  ];
}

export function oauthCookie(name: string, value: string, maxAge = 600): string {
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

export function randomState(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

async function verifySessionToken(token: string, secret: string): Promise<GoogleSessionPayload | null> {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  try {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const valid = await crypto.subtle.verify("HMAC", key, fromBase64Url(signature) as unknown as BufferSource, new TextEncoder().encode(encoded));
    if (!valid) return null;
    const payload = JSON.parse(decodeText(encoded)) as Partial<GoogleSessionPayload>;
    if (payload.provider !== "google" || typeof payload.email !== "string" || typeof payload.name !== "string" || typeof payload.exp !== "number") return null;
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload as GoogleSessionPayload;
  } catch {
    return null;
  }
}

async function sign(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))));
}

function encodeText(value: string): string {
  return toBase64Url(new TextEncoder().encode(value));
}

function decodeText(value: string): string {
  return new TextDecoder().decode(fromBase64Url(value));
}

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
