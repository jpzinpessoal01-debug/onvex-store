import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { AddressManager, ProfileForm } from "@/components/AccountForms";
import { getDb } from "@/db";
import { addresses, orders } from "@/db/schema";
import { getCurrentAppUser } from "@/lib/auth";
import { formatCurrency, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Minha conta", robots: { index: false, follow: false } };
type Params = Promise<{ section?: string[] }>;
const labels: Record<string, string> = { pedidos: "Meus pedidos", enderecos: "Endereços", favoritos: "Favoritos", dados: "Dados pessoais", senha: "Segurança" };

export default async function AccountPage({ params }: { params: Params }) {
  const { section = [] } = await params;
  const current = section[0] ?? "inicio";
  await requireChatGPTUser(`/minha-conta${current === "inicio" ? "" : `/${current}`}`);
  const user = await getCurrentAppUser();
  if (!user) return null;
  const db = await getDb();
  const [orderRows, addressRows, stats] = await Promise.all([
    db.select().from(orders).where(eq(orders.userId, user.id)).orderBy(desc(orders.createdAt)).limit(current === "pedidos" ? 50 : 5),
    db.select().from(addresses).where(eq(addresses.userId, user.id)).orderBy(desc(addresses.isDefault), desc(addresses.createdAt)),
    db.select({ count: sql<number>`count(*)`, total: sql<number>`coalesce(sum(case when ${orders.paymentStatus}='PAID' then ${orders.totalCents} else 0 end),0)` }).from(orders).where(eq(orders.userId, user.id)),
  ]);
  const menu = [["inicio","Minha conta"],["pedidos","Meus pedidos"],["enderecos","Endereços"],["favoritos","Favoritos"],["dados","Dados pessoais"],["senha","Segurança"]];
  return <main className="page-dark account-page"><div className="container account-head"><p className="eyebrow">ONVEX MEMBER</p><h1>OLÁ, {user.name.split(" ")[0].toUpperCase()}.</h1><p>{user.email}</p></div><div className="container account-layout"><aside className="account-nav">{menu.map(([slug,label]) => <Link key={slug} className={current === slug ? "is-active" : ""} href={slug === "inicio" ? "/minha-conta" : slug === "favoritos" ? "/favoritos" : `/minha-conta/${slug}`}>{label}<span>→</span></Link>)}{user.role !== "CUSTOMER" && <Link href="/admin">Painel administrativo<span>↗</span></Link>}<a href="/api/auth/logout?return_to=/">Sair<span>→</span></a></aside><section className="account-content"><div className="account-title"><p className="eyebrow">ÁREA DO CLIENTE</p><h2>{current === "inicio" ? "VISÃO GERAL" : (labels[current] ?? "MINHA CONTA").toUpperCase()}</h2></div>{current === "inicio" && <><div className="account-stats"><article><span>PEDIDOS</span><strong>{stats[0]?.count ?? 0}</strong></article><article><span>TOTAL INVESTIDO</span><strong>{formatCurrency(stats[0]?.total ?? 0)}</strong></article><article><span>NÍVEL</span><strong>ONVEX MEMBER</strong></article></div><OrderList orders={orderRows} /></>}{current === "pedidos" && <OrderList orders={orderRows} />}{current === "enderecos" && <AddressManager addresses={addressRows} />}{current === "dados" && <ProfileForm user={user} />}{current === "senha" && <div className="security-card"><h3>ACESSO PROTEGIDO</h3><p>Sua autenticação é gerenciada por identidade segura do ChatGPT ou Google. A ONVEX não recebe nem armazena sua senha.</p><a className="button button--outline" href="/api/auth/logout?return_to=/login">ENCERRAR TODAS AS SESSÕES</a></div>}</section></div></main>;
}

function OrderList({ orders: rows }: { orders: Array<typeof orders.$inferSelect> }) {
  if (!rows.length) return <div className="empty-state"><span>PEDIDOS</span><h3>Nenhum pedido ainda</h3><p>Seu histórico aparecerá aqui após a primeira compra.</p></div>;
  return <div className="account-orders"><div className="account-orders__head"><span>PEDIDO</span><span>DATA</span><span>STATUS</span><span>TOTAL</span><span /></div>{rows.map((order) => <Link href={`/pedido/${order.id}`} key={order.id}><strong>{order.orderNumber}</strong><span>{formatDate(order.createdAt)}</span><b>{order.status}</b><span>{formatCurrency(order.totalCents)}</span><i>→</i></Link>)}</div>;
}
