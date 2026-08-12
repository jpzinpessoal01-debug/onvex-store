import {
  GOOGLE_RETURN_COOKIE,
  GOOGLE_STATE_COOKIE,
  clearGoogleOAuthCookies,
  createGoogleSessionToken,
  getGoogleRuntimeEnv,
  safeReturnTo,
  sessionCookie,
} from "@/lib/google-auth";
import { upsertAppUser } from "@/lib/auth";

type GoogleTokenResponse = { access_token?: string; error?: string };
type GoogleProfile = { email?: string; name?: string; email_verified?: boolean };

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieHeader = request.headers.get("cookie") ?? "";
  const expectedState = readCookie(cookieHeader, GOOGLE_STATE_COOKIE);
  const returnTo = safeReturnTo(readCookie(cookieHeader, GOOGLE_RETURN_COOKIE));
  const clearCookies = clearGoogleOAuthCookies();

  if (url.searchParams.get("error") || !code || !state || !expectedState || state !== expectedState) {
    return redirectWithCookies(request, `/login?error=google_denied&returnTo=${encodeURIComponent(returnTo)}`, clearCookies);
  }

  const runtime = await getGoogleRuntimeEnv();
  const redirectUri = runtime.GOOGLE_REDIRECT_URI?.trim() || new URL("/api/auth/google/callback", request.url).toString();
  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: runtime.GOOGLE_CLIENT_ID?.trim() ?? "",
        client_secret: runtime.GOOGLE_CLIENT_SECRET?.trim() ?? "",
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });
    const token = await tokenResponse.json() as GoogleTokenResponse;
    if (!tokenResponse.ok || !token.access_token) throw new Error("Google token exchange failed.");

    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { authorization: `Bearer ${token.access_token}` },
    });
    const profile = await profileResponse.json() as GoogleProfile;
    if (!profileResponse.ok || !profile.email || profile.email_verified !== true) throw new Error("Google profile is not verified.");

    const identity = { email: profile.email, displayName: profile.name?.trim() || profile.email.split("@")[0] };
    await upsertAppUser(identity);
    const signedSession = await createGoogleSessionToken({ email: identity.email, name: identity.displayName });
    return redirectWithCookies(request, returnTo, [...clearCookies, sessionCookie(signedSession)]);
  } catch {
    return redirectWithCookies(request, `/login?error=google_failed&returnTo=${encodeURIComponent(returnTo)}`, clearCookies);
  }
}

function readCookie(header: string, name: string): string | null {
  const match = header.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  if (!match) return null;
  try {
    return decodeURIComponent(match.slice(name.length + 1));
  } catch {
    return null;
  }
}

function redirectWithCookies(request: Request, location: string, cookies: string[]) {
  const headers = new Headers({ location: new URL(location, request.url).toString(), "cache-control": "no-store" });
  cookies.forEach((cookie) => headers.append("set-cookie", cookie));
  return new Response(null, { status: 303, headers });
}
