import type { Metadata } from "next";
import { chatGPTSignInPath } from "@/app/chatgpt-auth";
import { googleAuthConfigured, googleSignInPath } from "@/lib/google-auth";

export const metadata: Metadata = { title: "Criar conta" };
export default async function RegisterPage() { const googleReady = await googleAuthConfigured(); return <main className="simple-auth page-dark"><div><p className="eyebrow">PRIMEIRO ACESSO</p><h1>CRIE SUA CONTA<br />SEM CRIAR OUTRA SENHA.</h1><p>Entre com ChatGPT ou Google e seu perfil ONVEX Member será criado automaticamente como cliente. O acesso administrativo continua protegido por permissões internas.</p><div className="auth-register-actions"><a className="button button--silver" href={chatGPTSignInPath("/minha-conta")}>CONTINUAR COM CHATGPT →</a>{googleReady && <a className="button button--outline" href={googleSignInPath("/minha-conta")}>CONTINUAR COM GOOGLE →</a>}</div></div></main>; }
