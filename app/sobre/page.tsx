import type { Metadata } from "next";
import Link from "next/link";
import PaginaInstitucionalLayout from "@/components/site/PaginaInstitucional";
import { BRAND_NAME, SUPPORT_EMAIL } from "@/lib/guias";
import { paginaPublicada } from "@/lib/institucional";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: `Sobre o ${BRAND_NAME}: quem escreve os guias`,
  description:
    "Quem está por trás do Copiloto Carreira, por que os guias de carreira em PDF foram criados e como cada guia é escrito, revisado e atualizado.",
  path: "/sobre",
  noindex: !paginaPublicada("sobre"),
});

/*
 * TODO_DADO_REAL (dono do site): confirmar nome, cargo e experiência do autor,
 * o processo real de produção dos guias e o link do LinkedIn antes de publicar
 * (PAGINAS_INSTITUCIONAIS.sobre.publicada = true). Nada aqui é inventado: o
 * texto usa só o que o próprio dono informou sobre a trajetória profissional.
 */
export default function SobrePage() {
  return (
    <PaginaInstitucionalLayout pagina="sobre" titulo={`Sobre o ${BRAND_NAME}`}>
      <p>
        O {BRAND_NAME} é escrito por Fábio Lago Kroker, engenheiro de dados e de Business Intelligence com mais de 4
        anos de experiência em empresas brasileiras. TODO_DADO_REAL: confirmar texto, cargo atual e foto.
      </p>

      <h2>Por que criei os guias</h2>
      <p>
        Muita gente boa trava no mesmo ponto: entrega bem, mas o trabalho não aparece para quem decide. Os guias
        organizam esse próximo passo em etapas pequenas, uma por semana, e mostram onde a IA tira peso da rotina
        para sobrar tempo para o que gera reconhecimento.
      </p>

      <h2>Como os guias são feitos</h2>
      <ul>
        <li>Um guia por profissão, com exemplos e prompts da rotina daquela área.</li>
        <li>Revisão antes de cada versão. TODO_DADO_REAL: descrever quem revisa e como.</li>
        <li>Atualizações enviadas para o mesmo e-mail da compra.</li>
      </ul>

      <h2>Fale comigo</h2>
      <p>
        Dúvidas, sugestões ou problemas com o seu guia: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        TODO_DADO_REAL: LinkedIn oficial, se houver.
      </p>
      <p>
        Leia também os <Link href="/termos">Termos de uso</Link> e a <Link href="/privacidade">Política de privacidade</Link>.
      </p>
    </PaginaInstitucionalLayout>
  );
}
