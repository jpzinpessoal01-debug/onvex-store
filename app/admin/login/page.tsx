import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Login administrativo", robots: { index: false, follow: false } };
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminLoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const rawReturn = Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo;
  const returnTo = rawReturn?.startsWith("/admin") && !rawReturn.startsWith("//") ? rawReturn : "/admin";
  const error = (Array.isArray(params.error) ? params.error[0] : params.error) === "invalid";

  return (
    <main className="auth-page admin-login-page">
      <div className="auth-visual"><span>ONVEX</span><div><p className="eyebrow">CONTROL CENTER</p><h1>GESTÃO<br />TOTAL DA<br />ONVEX.</h1></div></div>
      <div className="auth-panel"><div>
        <p className="eyebrow">ACESSO RESTRITO</p>
        <h2>PAINEL ADMIN.</h2>
        <p>Área exclusiva para gerenciamento de produtos, estoque, pedidos, clientes, cupons, banners e configurações da loja.</p>
        <form className="admin-login-form" action="/api/auth/admin-login" method="post">
          <input type="hidden" name="returnTo" value={returnTo} />
          <label><span>USUÁRIO</span><input name="username" autoComplete="username" required placeholder="Usuário administrativo" /></label>
          <label><span>SENHA</span><input type="password" name="password" autoComplete="current-password" required placeholder="Senha de acesso" /></label>
          {error && <p className="auth-error" role="alert">Usuário ou senha inválidos.</p>}
          <button className="button button--silver auth-button" type="submit">ENTRAR NO PAINEL <span>→</span></button>
        </form>
        <p className="auth-links"><Link href="/">← Voltar para a loja</Link></p>
      </div></div>
    </main>
  );
}
