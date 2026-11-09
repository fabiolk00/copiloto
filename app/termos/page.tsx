import type { Metadata } from "next";
import PaginaInstitucionalLayout from "@/components/site/PaginaInstitucional";
import { BRAND_NAME, SUPPORT_EMAIL } from "@/lib/guias";
import { paginaPublicada } from "@/lib/institucional";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: `Termos de uso | ${BRAND_NAME}`,
  description:
    "Condições de compra e uso dos guias de carreira em PDF do Copiloto Carreira: o que é o produto, como é entregue, licença de uso pessoal e contato.",
  path: "/termos",
  noindex: !paginaPublicada("termos"),
});

/* ESBOÇO. Só publicar após revisão jurídica do dono (PAGINAS_INSTITUCIONAIS.termos.publicada). */
export default function TermosPage() {
  return (
    <PaginaInstitucionalLayout pagina="termos" titulo="Termos de uso">
      <h2>O produto</h2>
      <p>
        Guia digital em PDF, por profissão, acompanhado de um modelo de currículo em .docx. Pagamento único via Pix.
      </p>

      <h2>Entrega</h2>
      <p>
        Os arquivos são enviados para o e-mail informado na compra, após a confirmação do pagamento. O acesso ao PDF
        é permanente.
      </p>

      <h2>Licença de uso</h2>
      <p>Uso pessoal e intransferível. Não é permitido revender, redistribuir ou publicar o conteúdo.</p>

      <h2>Arrependimento e reembolso</h2>
      <p>
        TODO_REVISAO_JURIDICA: política real de reembolso e aplicação do direito de arrependimento (CDC, art. 49) a
        produto digital.
      </p>

      <h2>Limitação de responsabilidade</h2>
      <p>
        O guia orienta e organiza etapas de carreira; ele não garante promoção, contratação nem qualquer resultado
        específico.
      </p>

      <h2>Contato</h2>
      <p>
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. TODO_REVISAO_JURIDICA: identificação do fornecedor.
      </p>
    </PaginaInstitucionalLayout>
  );
}
