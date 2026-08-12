import type { Metadata } from "next";
import { CartPage } from "@/components/CartPage";

export const metadata: Metadata = { title: "Carrinho" };

export default function CartRoute() {
  return <CartPage />;
}

