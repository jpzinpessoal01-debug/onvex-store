import type { Metadata } from "next";
import { ContentPage } from "@/components/ContentPage";
export const metadata:Metadata={title:"Sobre a ONVEX"};
export default function AboutPage(){return <ContentPage eyebrow="NOSSA ESSÊNCIA" title="FORJADA NA DISCIPLINA." intro="A ONVEX existe para quem entende que o próximo nível é construído em cada detalhe."><div className="content-sections"><section><h2>POR QUE ONVEX</h2><p>Desenvolvemos equipamentos com equilíbrio entre resistência, mobilidade e uma identidade visual limpa. O objetivo é simples: entregar produtos que acompanhem treinos intensos sem roubar sua atenção do que importa.</p></section><section><h2>NO TATAME, SEM ATALHOS</h2><p>Qualidade é tratada como processo. Modelagem, tecidos, reforços, acabamento e experiência de compra precisam funcionar juntos. A mesma disciplina do Jiu-Jitsu guia as decisões da marca.</p></section><blockquote>“Evolução não acontece por acaso.”<span>— ONVEX</span></blockquote></div></ContentPage>}

