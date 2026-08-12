import {
  GOOGLE_RETURN_COOKIE,
  GOOGLE_STATE_COOKIE,
  getGoogleRuntimeEnv,
  oauthCookie,
  randomState,
  safeReturnTo,
} from "@/lib/google-auth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const runtime = await getGoogleRuntimeEnv();
  const returnTo = safeReturnTo(url.searchParams.get("return_to"));
  if (!runtime.GOOGLE_CLIENT_ID?.trim() || !runtime.GOOGLE_CLIENT_SECRET?.trim() || !(runtime.AUTH_SECRET?.trim() || runtime.GOOGLE_CLIENT_SECRET?.trim())) {
    return redirectWithCookies(request, `/login?error=google_not_configured&returnTo=${encodeURIComponent(returnTo)}`, []);
  }

  const redirectUri = runtime.GOOGLE_REDIRECT_URI?.trim() || new URL("/api/auth/google/callback", request.url).toString();
  const state = randomState();
  const authorization = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorization.searchParams.set("client_id", runtime.GOOGLE_CLIENT_ID.trim());
  authorization.searchParams.set("redirect_uri", redirectUri);
  authorization.searchParams.set("response_type", "code");
  authorization.searchParams.set("scope", "openid email profile");
  authorization.searchParams.set("state", state);
  authorization.searchParams.set("prompt", "select_account");

  return redirectWithCookies(request, authorization.toString(), [
    oauthCookie(GOOGLE_STATE_COOKIE, state),
    oauthCookie(GOOGLE_RETURN_COOKIE, returnTo),
  ]);
}

function redirectWithCookies(request: Request, location: string, cookies: string[]) {
  const headers = new Headers({ location: new URL(location, request.url).toString(), "cache-control": "no-store" });
  cookies.forEach((cookie) => headers.append("set-cookie", cookie));
  return new Response(null, { status: 303, headers });
}
