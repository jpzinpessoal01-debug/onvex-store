import { getChatGPTUser, chatGPTSignOutPath } from "@/app/chatgpt-auth";
import { clearGoogleSessionCookie, safeReturnTo } from "@/lib/google-auth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const returnTo = safeReturnTo(url.searchParams.get("return_to"), "/");
  const headers = new Headers({ "cache-control": "no-store" });
  headers.append("set-cookie", clearGoogleSessionCookie());
  const chatGPTUser = await getChatGPTUser();
  const destination = chatGPTUser ? chatGPTSignOutPath(returnTo) : returnTo;
  headers.set("location", new URL(destination, request.url).toString());
  return new Response(null, { status: 303, headers });
}
