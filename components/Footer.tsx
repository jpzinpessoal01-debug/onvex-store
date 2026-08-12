import Link from "next/link";
import { getStoreSettings } from "@/lib/store";
import { Logo } from "./Logo";

const columns = [
  { title: "Institucional", links: [["Sobre nós", "/sobre"], ["Contato", "/contato"], ["Privacidade", "/privacidade"], ["Termos", "/termos"]] },
  { title: "Atendimento", links: [["Trocas e devoluções", "/trocas-e-devolucoes"], ["Envios", "/contato#envios"], ["FAQ", "/contato#faq"]] },
  { title: "Minha conta", links: [["Pedidos", "/minha-conta/pedidos"], ["Favoritos", "/favoritos"], ["Endereços", "/minha-conta/enderecos"]] },
];

export async function Footer() {
  const settings = await getStoreSettings();
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-brand">
          <Logo compact />
          <p>{settings.footer_text ?? "Equipamentos para quem leva cada rola a sério. Performance, resistência e identidade no tatame."}</p>
          <p className="footer-contact">{settings.support_email}<br />{settings.support_phone}</p>
          <div className="social-links"><a href={settings.instagram ?? "https://instagram.com/onvex"} rel="noreferrer">Instagram</a><a href={settings.tiktok ?? "https://tiktok.com/@onvex"} rel="noreferrer">TikTok</a><a href={settings.whatsapp ?? "https://wa.me/5500000000000"} rel="noreferrer">WhatsApp</a></div>
        </div>
        {columns.map((column) => (
          <div className="footer-column" key={column.title}>
            <h3>{column.title}</h3>
            {column.links.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
          </div>
        ))}
      </div>
      <div className="container footer-bottom"><p>© {new Date().getFullYear()} ONVEX. Todos os direitos reservados.</p><p>PIX • Cartão • Pagamento seguro</p></div>
    </footer>
  );
}
