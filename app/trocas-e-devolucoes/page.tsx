import type { Metadata } from "next";
import { ContentPage } from "@/components/ContentPage";
export const metadata:Metadata={title:"Trocas e devoluções"};
export default function ReturnsPage(){return <ContentPage eyebrow="ATENDIMENTO" title="TROCAS E DEVOLUÇÕES." intro="Um processo claro para resolver imprevistos sem complicação."><div className="content-sections"><section><h2>ARREPENDIMENTO</h2><p>Você pode solicitar a devolução em até 7 dias corridos após o recebimento, conforme a legislação aplicável. O produto deve estar sem uso, com etiquetas, embalagem e acessórios.</p></section><section><h2>TROCA DE TAMANHO</h2><p>Entre em contato informando o número do pedido e a variante desejada. A troca depende de disponibilidade em estoque e passa por conferência.</p></section><section><h2>PRODUTO COM DEFEITO</h2><p>Envie fotos e uma descrição do problema. O time analisará o caso e orientará a coleta, substituição ou reembolso quando aplicável.</p></section></div></ContentPage>}

