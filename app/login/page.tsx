import type { Metadata } from "next";
import Link from "next/link";
import { chatGPTSignInPath } from "@/app/chatgpt-auth";
import { ShieldIcon } from "@/components/icons";
import { googleAuthConfigured, googleSignInPath } from "@/lib/google-auth";

export const metadata: Metadata = { title: "Entrar" };
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const raw = Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo;
  const returnTo = raw?.startsWith("/") && !raw.startsWith("//") ? raw : "/minha-conta";
  const googleReady = await googleAuthConfigured();
  const errorCode = Array.isArray(params.error) ? params.error[0] : params.error;
  const errorMessage = errorCode === "google_not_configured" ? "O login Google está aguardando a configuração OAuth da loja." : errorCode === "google_denied" ? "O login Google foi cancelado. Você pode tentar novamente." : errorCode === "google_failed" ? "Não foi possível validar sua conta Google agora." : null;
  return <main className="auth-page"><div className="auth-visual"><span>ONVEX</span><div><p className="eyebrow">ONVEX MEMBER</p><h1>SEU PRÓXIMO<br />NÍVEL COMEÇA<br />AQUI.</h1></div></div><div className="auth-panel"><div><p className="eyebrow">ACESSO SEGURO</p><h2>ENTRE NA SUA CONTA.</h2><p>Escolha uma identidade segura para acompanhar pedidos, favoritos e benefícios ONVEX Member.</p><div className="auth-providers"><a className="button button--silver auth-button" href={chatGPTSignInPath(returnTo)}>ENTRAR COM CHATGPT <span>→</span></a>{googleReady ? <a className="button button--google auth-button" href={googleSignInPath(returnTo)}><b>G</b> CONTINUAR COM GOOGLE <span>→</span></a> : <div className="auth-provider-pending"><b>G</b><span><strong>LOGIN GOOGLE EM CONFIGURAÇÃO</strong><small>Disponível assim que o OAuth da loja for ativado.</small></span></div>}</div>{errorMessage && <p className="auth-error" role="alert">{errorMessage}</p>}<div className="auth-security"><ShieldIcon /><span><strong>IDENTIDADE PROTEGIDA</strong>A loja recebe apenas nome e e-mail confirmados. Nenhuma senha é armazenada.</span></div><p className="auth-links">Primeiro acesso? <Link href="/cadastro">Veja como funciona</Link></p></div></div></main>;
}
