import type { Metadata } from "next";
import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { CheckoutPage } from "@/components/CheckoutPage";
import { getCurrentAppUser } from "@/lib/auth";
import { getStoreSettings } from "@/lib/store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Checkout", robots: { index: false, follow: false } };

export default async function CheckoutRoute() {
  await requireChatGPTUser("/checkout");
  const [user, settings] = await Promise.all([getCurrentAppUser(), getStoreSettings()]);
  if (!user) return null;
  return <CheckoutPage user={user} cpfRequired={settings.cpf_required === "true"} />;
}
