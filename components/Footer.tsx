import Link from "next/link";
import { getStoreSettings } from "@/lib/store";
import { Logo } from "./Logo";

const columns = [
  { title: "Institucional", links: [["Sobre nós", "/sobre"], ["Contato", "/contato"], ["Privacidade", "/privacidade"], ["Termos", "/termos"]] },
  { title: "Atendimento", links: [["Trocas e devoluções", "/trocas-e-devolucoes"], ["Envios", "/contato#envios"], ["FAQ", "/contato#faq"]] },
  { title: "Minha conta", links: [["Pedidos", "/minha-conta/pedidos"], ["Favoritos", "/favoritos"], ["Endereços", "/minha-conta/enderecos"]] },
];

function isUsefulContact(value?: string) {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized !== "(00) 00000-0000" && normalized !== "00000000000" && !normalized.includes("exemplo");
}

export async function Footer() {
  const settings = await getStoreSettings();
  const email = isUsefulContact(settings.support_email) ? settings.support_email : undefined;
  const phone = isUsefulContact(settings.support_phone) ? settings.support_phone : undefined;
  const socials = [
    ["Instagram", settings.instagram],
    ["TikTok", settings.tiktok],
    ["WhatsApp", settings.whatsapp],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));

  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-brand">
          <Logo compact />
          <p>{settings.footer_text ?? "Equipamentos para quem leva cada rola a sério. Performance, resistência e identidade no tatame."}</p>
          {(email || phone) && <p className="footer-contact">{email}{email && phone && <br />}{phone}</p>}
          {socials.length > 0 && <div className="social-links">{socials.map(([label, href]) => <a key={label} href={href} rel="noreferrer" target="_blank">{label}</a>)}</div>}
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
