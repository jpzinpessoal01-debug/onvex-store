import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon, BoxIcon, RotateIcon, ShieldIcon, TruckIcon } from "@/components/icons";
import { ProductGrid } from "@/components/ProductGrid";
import { Reveal } from "@/components/Reveal";
import { getActiveBanner, listCategories, listProducts, getStoreSettings } from "@/lib/store";

export const dynamic = "force-dynamic";

const categoryArtwork: Record<string, string> = {
  kimonos: "/onvex-kimono.webp",
  "rash-guards": "/onvex-rash-guard.webp",
  faixas: "/onvex-belt.webp",
  shorts: "/onvex-fight-shorts.webp",
  acessorios: "/onvex-backpack.webp",
};

export default async function Home() {
  const [featured, categoryRows, settings, banner] = await Promise.all([
    listProducts({ featured: true, limit: 5 }),
    listCategories(),
    getStoreSettings(),
    getActiveBanner(),
  ]);
  const mainCategories = categoryRows.slice(0, 3);
  const heroTitle = banner?.title ?? settings.hero_title ?? "DOMINE CADA ROLAMENTO.";
  const heroSubtitle = banner?.description ?? settings.hero_subtitle ?? "Produtos desenvolvidos para quem vive o Jiu-Jitsu.";

  return (
    <main>
      <section className="hero">
        <Image src={banner?.imageUrl ?? "/onvex-hero.webp"} alt="Atleta de Jiu-Jitsu usando kimono preto" fill priority sizes="100vw" className="hero__image" />
        <div className="hero__shade" />
        <div className="container hero__content">
          <p className="eyebrow">ONVEX / JIU-JITSU PERFORMANCE</p>
          <h1>{heroTitle}</h1>
          <p className="hero__subtitle">{heroSubtitle}</p>
          <div className="hero__actions">
            <Link className="button button--silver" href={banner?.link ?? "/loja"}>COMPRAR AGORA <ArrowRightIcon /></Link>
            <Link className="button button--ghost" href="#colecao">VER COLEÇÃO</Link>
          </div>
          <div className="hero__index"><span>01</span><div /><span>05</span></div>
        </div>
        <div className="hero__scroll">ROLE PARA EXPLORAR <span>↓</span></div>
      </section>

      <section className="benefit-strip">
        <div className="container benefit-grid">
          <article><TruckIcon /><div><strong>ENVIO PARA TODO BRASIL</strong><span>Rastreio em cada etapa</span></div></article>
          <article><ShieldIcon /><div><strong>COMPRA 100% SEGURA</strong><span>Seus dados protegidos</span></div></article>
          <article><RotateIcon /><div><strong>TROCA DESCOMPLICADA</strong><span>Até 7 dias após receber</span></div></article>
          <article><BoxIcon /><div><strong>PRODUTO PREMIUM</strong><span>Qualidade testada no tatame</span></div></article>
        </div>
      </section>

      <section className="section category-section" id="colecao">
        <Reveal className="container">
          <div className="section-heading">
            <div><p className="eyebrow">COLEÇÃO ONVEX</p><h2>EQUIPAMENTO PARA<br />CADA ROLAMENTO.</h2></div>
            <Link href="/loja" className="text-link">VER TODOS <ArrowRightIcon /></Link>
          </div>
          <div className="category-grid">
            {mainCategories.map((category, index) => (
              <Link href={`/categoria/${category.slug}`} className="category-card" key={category.id}>
                <Image src={category.imageUrl ?? categoryArtwork[category.slug] ?? "/onvex-kimono.webp"} alt={category.name} fill sizes="(max-width: 700px) 100vw, 50vw" />
                <div className="category-card__shade" />
                <div className="category-card__content"><span>0{index + 1}</span><h3>{category.name.toUpperCase()}</h3><p>{category.description}</p><b>EXPLORAR <ArrowRightIcon /></b></div>
              </Link>
            ))}
          </div>
        </Reveal>
      </section>

      <section className="section featured-section">
        <Reveal className="container">
          <div className="section-heading section-heading--center">
            <div><p className="eyebrow">ESCOLHAS DA EQUIPE</p><h2>MAIS VENDIDOS.</h2><p className="section-copy">Os favoritos de quem não abre mão de performance e durabilidade.</p></div>
          </div>
          <ProductGrid products={featured} />
          <div className="section-cta"><Link className="button button--outline" href="/loja">VER TODOS OS PRODUTOS <ArrowRightIcon /></Link></div>
        </Reveal>
      </section>

      <section className="manifesto">
        <div className="manifesto__image"><Image src="/onvex-hero.webp" alt="Jiu-Jitsu ONVEX" fill sizes="(max-width: 900px) 100vw, 50vw" /></div>
        <div className="manifesto__content"><p className="eyebrow">ALÉM DO TATAME</p><h2>FORJADO NA<br />DISCIPLINA.</h2><p>ONVEX nasceu para quem entende que evolução não acontece por acaso. Cada treino, cada detalhe e cada escolha constroem o próximo nível.</p><Link className="text-link" href="/sobre">CONHEÇA A ONVEX <ArrowRightIcon /></Link><span className="manifesto__mark">ONVEX</span></div>
      </section>

      <section className="newsletter">
        <div className="container newsletter__inner"><div><p className="eyebrow">ONVEX INNER CIRCLE</p><h2>ENTRE PARA O TIME.</h2><p>Receba lançamentos, reposições e condições exclusivas.</p></div><form action="/api/newsletter" method="post"><input type="email" name="email" required placeholder="SEU MELHOR E-MAIL" aria-label="Seu e-mail" /><button className="button button--silver" type="submit">QUERO ENTRAR <ArrowRightIcon /></button></form></div>
      </section>
    </main>
  );
}
