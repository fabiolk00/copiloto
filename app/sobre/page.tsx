import type { Metadata } from "next";
import Link from "next/link";
import PaginaInstitucionalLayout from "@/components/site/PaginaInstitucional";
import { BRAND_NAME, SUPPORT_EMAIL } from "@/lib/guias";
import { paginaVisivel } from "@/lib/institucional";
import { institucionalMetadata } from "@/lib/seo";

export const metadata: Metadata = institucionalMetadata("sobre", {
  title: `Sobre o ${BRAND_NAME}: quem escreve os guias`,
  description:
    "Quem está por trás do Copiloto Carreira, por que os guias de carreira em PDF foram criados e como cada guia é construído, revisado e atualizado.",
});

/*
 * RASCUNHO (não publicar). Cada TODO_CONFIRMAR depende de confirmação do dono.
 * Regra editorial: não afirmar experiência de primeira mão nas áreas dos guias
 * (Financeiro, Comercial, Marketing, Customer Success, Administrativo) sem que
 * ela exista; a credencial do autor só entra depois de confirmada.
 */
export default function SobrePage() {
  return (
    <PaginaInstitucionalLayout pagina="sobre" titulo={`Sobre o ${BRAND_NAME}`}>
      <p>
        O {BRAND_NAME} reúne guias digitais em PDF, um por profissão, para quem quer organizar a rotina e dar o próximo
        passo de carreira com apoio de IA.
      </p>
      <p>
        Quem escreve: TODO_CONFIRMAR nome. Cargo atual: TODO_CONFIRMAR. Tempo de experiência: TODO_CONFIRMAR. Foto:
        TODO_CONFIRMAR.
      </p>

      <h2>Por que os guias existem</h2>
      <p>
        Muita gente entrega bem, mas o trabalho não aparece para quem decide. Os guias organizam esse próximo passo em
        etapas pequenas, uma por semana, e mostram onde a IA pode tirar peso das tarefas repetitivas.
      </p>

      <h2>Como os guias são construídos</h2>
      <ul>
        <li>
          Um guia por área, com o mesmo método em 3 partes e 8 semanas, adaptado a exemplos e prompts de cada rotina.
        </li>
        <li>Fontes e pesquisa usadas para cada área: TODO_CONFIRMAR.</li>
        <li>Quem revisou ou validou o conteúdo de cada área, e com qual experiência: TODO_CONFIRMAR.</li>
        <li>Atualizações do guia são enviadas para o mesmo e-mail da compra.</li>
      </ul>

      <h2>Contato</h2>
      <p>
        Dúvidas, sugestões ou problemas com o seu guia: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        LinkedIn: TODO_CONFIRMAR.
      </p>
      {(paginaVisivel("termos") || paginaVisivel("privacidade")) && (
        <p>
          Leia também
          {paginaVisivel("termos") && (
            <>
              {" "}
              os <Link href="/termos">Termos de uso</Link>
            </>
          )}
          {paginaVisivel("termos") && paginaVisivel("privacidade") && " e"}
          {paginaVisivel("privacidade") && (
            <>
              {" "}
              a <Link href="/privacidade">Política de privacidade</Link>
            </>
          )}
          .
        </p>
      )}
    </PaginaInstitucionalLayout>
  );
}
