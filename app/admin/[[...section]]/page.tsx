import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdminPage } from "@/lib/auth";
import {
  getAdminBanners, getAdminCategories, getAdminCoupons, getAdminCustomers, getAdminDashboard, getAdminInventory,
  getAdminLogs, getAdminMovements, getAdminOrders, getAdminProducts, getAdminReviews, getAdminSettings, getAdminUsers,
} from "@/lib/admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Painel administrativo", robots: { index: false, follow: false } };
type Params = Promise<{ section?: string[] }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined { return Array.isArray(value) ? value[0] : value; }

function reportRange(query: Record<string, string | string[] | undefined>) {
  const key = first(query.period) ?? "30";
  const now = new Date();
  const end = now.toISOString();
  if (key === "today") return { since: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString(), until: end, label: "hoje", key };
  if (key === "7") return { since: new Date(now.getTime() - 7 * 86400000).toISOString(), until: end, label: "7 dias", key };
  if (key === "month") return { since: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString(), until: end, label: "este mês", key };
  if (key === "custom") {
    const from = first(query.from); const to = first(query.to);
    if (from && to && /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
      const since = new Date(`${from}T00:00:00.000Z`).toISOString();
      const until = new Date(`${to}T23:59:59.999Z`).toISOString();
      if (since <= until) return { since, until, label: `${from} a ${to}`, key };
    }
  }
  return { since: new Date(now.getTime() - 30 * 86400000).toISOString(), until: end, label: "30 dias", key: "30" };
}

export default async function AdminPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { section = [] } = await params;
  const query = await searchParams;
  const current = section.join("/") || "dashboard";
  const admin = await requireAdminPage(`/admin${section.length ? `/${section.join("/")}` : ""}`);
  let data: unknown = null;
  let categories: Awaited<ReturnType<typeof getAdminCategories>> = [];
  let catalog: Awaited<ReturnType<typeof getAdminProducts>> = [];

  switch (current) {
    case "dashboard": data = await getAdminDashboard(); break;
    case "produtos": data = await getAdminProducts(); break;
    case "produtos/novo": categories = await getAdminCategories(); break;
    case "categorias": data = await getAdminCategories(); break;
    case "estoque": data = await getAdminInventory(); break;
    case "estoque/movimentacoes": data = await getAdminMovements(); break;
    case "pedidos": data = await getAdminOrders(); break;
    case "clientes": data = await getAdminCustomers(); break;
    case "cupons": [data, categories, catalog] = await Promise.all([getAdminCoupons(), getAdminCategories(), getAdminProducts()]); break;
    case "avaliacoes": data = await getAdminReviews(); break;
    case "banners": data = await getAdminBanners(); break;
    case "relatorios": data = await getAdminDashboard(reportRange(query)); break;
    case "configuracoes": data = await getAdminSettings(); break;
    case "administradores": data = await getAdminUsers(); break;
    case "logs": data = await getAdminLogs(); break;
    default: data = await getAdminDashboard();
  }

  const rawEdit = Array.isArray(query.edit) ? query.edit[0] : query.edit;
  return <AdminShell admin={admin} section={current} data={data} categories={categories} catalog={catalog} editId={rawEdit ? Number(rawEdit) : undefined} />;
}
