import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import styles from "./admin-login.module.css";

export const metadata: Metadata = { title: "Login administrativo", robots: { index: false, follow: false } };
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminLoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const rawReturn = Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo;
  const returnTo = rawReturn?.startsWith("/admin") && !rawReturn.startsWith("//") ? rawReturn : "/admin";
  const error = (Array.isArray(params.error) ? params.error[0] : params.error) === "invalid";

  return (
    <main className={styles.page}>
      <div className={styles.lightA} />
      <div className={styles.lightB} />
      <section className={styles.shell}>
        <aside className={styles.brandPanel}>
          <div className={styles.brand}>
            <div className={styles.brandMark}>
              <Image src="/favicon.svg" alt="ONVEX" width={58} height={58} priority />
              <div className={styles.logo}>ONVEX</div>
            </div>
            <p className={styles.kicker}>CONTROLE TOTAL DA SUA LOJA</p>
            <h1 className={styles.title}>PAINEL <span>ADMINISTRATIVO</span></h1>
            <p className={styles.copy}>Gerencie produtos, pedidos, clientes, cupons, banners, estoque e toda a estrutura visual da sua loja ONVEX em um só lugar.</p>
          </div>

          <div className={styles.features}>
            <article className={styles.feature}><div className={styles.featureIcon}>◇</div><strong>Produtos</strong><small>Catálogo, fotos e preços</small></article>
            <article className={styles.feature}><div className={styles.featureIcon}>▣</div><strong>Pedidos</strong><small>Vendas, status e histórico</small></article>
            <article className={styles.feature}><div className={styles.featureIcon}>◎</div><strong>Clientes</strong><small>Cadastros e informações</small></article>
            <article className={styles.feature}><div className={styles.featureIcon}>%</div><strong>Cupons</strong><small>Promoções e descontos</small></article>
            <article className={styles.feature}><div className={styles.featureIcon}>▱</div><strong>Banners</strong><small>Destaques e campanhas</small></article>
            <article className={styles.feature}><div className={styles.featureIcon}>⚙</div><strong>Configurações</strong><small>Controle completo da loja</small></article>
          </div>
          <small className={styles.copyright}>© 2026 ONVEX. Todos os direitos reservados.</small>
        </aside>

        <div className={styles.loginPanel}>
          <div className={styles.loginBox}>
            <div className={styles.lock}><Image src="/favicon.svg" alt="" width={28} height={28} /></div>
            <div className={styles.heading}>
              <p>ACESSO RESTRITO</p>
              <h1>Entrar no Painel</h1>
              <span>Use suas credenciais administrativas da ONVEX.</span>
            </div>

            <form className={styles.form} action="/api/auth/admin-login" method="post">
              <input type="hidden" name="returnTo" value={returnTo} />
              <label className={styles.field}>
                <span>Usuário</span>
                <div className={styles.inputWrap}><span className={styles.inputIcon}>◎</span><input name="username" autoComplete="username" required placeholder="Digite seu usuário" /></div>
              </label>
              <label className={styles.field}>
                <span>Senha</span>
                <div className={styles.inputWrap}><span className={styles.inputIcon}>⌁</span><input type="password" name="password" autoComplete="current-password" required placeholder="Digite sua senha" /></div>
              </label>
              {error && <p className={styles.error} role="alert">Usuário ou senha inválidos.</p>}
              <button className={styles.submit} type="submit"><span>ENTRAR NO PAINEL</span><b>→</b></button>
            </form>

            <div className={styles.divider}>OU</div>
            <Link className={styles.back} href="/">↗&nbsp;&nbsp; Voltar para a loja</Link>
            <p className={styles.secure}><span>⌾</span>Acesso seguro e protegido.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
