import type { Metadata } from "next";
import Link from "next/link";
export const metadata: Metadata = { title: "Recuperar acesso" };
export default function ForgotPage() { return <main className="simple-auth page-dark"><div><p className="eyebrow">RECUPERAR ACESSO</p><h1>SUA SENHA NÃO FICA NA ONVEX.</h1><p>A autenticação é protegida pelo provedor escolhido no login. Recupere o acesso pelo ChatGPT ou Google e depois volte para a ONVEX.</p><Link className="button button--silver" href="/login">VOLTAR PARA O LOGIN →</Link></div></main>; }
