import type { Metadata } from "next";
import Link from "next/link";
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
  const errorMessage = errorCode === "google_not_configured"
    ? "O acesso Google ainda precisa ser ativado nas configurações da loja."
    : errorCode === "google_denied"
      ? "O login Google foi cancelado. Você pode tentar novamente."
      : errorCode === "google_failed"
        ? "Não foi possível validar sua conta Google agora."
        : null;

  return (
    <main className="auth-page">
      <div className="auth-visual">
        <span>ONVEX</span>
        <div>
          <p className="eyebrow">ONVEX MEMBER</p>
          <h1>SEU PRÓXIMO<br />NÍVEL COMEÇA<br />AQUI.</h1>
        </div>
      </div>
      <div className="auth-panel">
        <div>
          <p className="eyebrow">ACESSO ONVEX</p>
          <h2>ENTRE NA SUA CONTA.</h2>
          <p>Acesse sua conta para acompanhar pedidos, favoritos, benefícios e o painel administrativo quando autorizado.</p>
          <div className="auth-providers">
            {googleReady ? (
              <a className="button button--google auth-button" href={googleSignInPath(returnTo)}>
                <b>G</b> CONTINUAR COM GOOGLE <span>→</span>
              </a>
            ) : (
              <div className="auth-provider-pending">
                <b>G</b>
                <span><strong>ACESSO GOOGLE EM CONFIGURAÇÃO</strong><small>O botão será liberado assim que as credenciais OAuth forem ativadas.</small></span>
              </div>
            )}
          </div>
          {errorMessage && <p className="auth-error" role="alert">{errorMessage}</p>}
          <div className="auth-security">
            <ShieldIcon />
            <span><strong>IDENTIDADE PROTEGIDA</strong>A ONVEX recebe somente os dados necessários para identificar sua conta.</span>
          </div>
          <p className="auth-links">Quer continuar navegando? <Link href="/loja">Voltar para a loja</Link></p>
        </div>
      </div>
    </main>
  );
}
