import type { Metadata } from "next";
import PaginaInstitucionalLayout from "@/components/site/PaginaInstitucional";
import { BRAND_NAME, SUPPORT_EMAIL } from "@/lib/guias";
import { paginaPublicada } from "@/lib/institucional";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: `Política de privacidade | ${BRAND_NAME}`,
  description:
    "Quais dados o Copiloto Carreira coleta na compra dos guias em PDF, para que são usados, com quem são compartilhados e como exercer seus direitos pela LGPD.",
  path: "/privacidade",
  noindex: !paginaPublicada("privacidade"),
});

/*
 * ESBOÇO. Só publicar após revisão jurídica do dono (PAGINAS_INSTITUCIONAIS.privacidade.publicada).
 * Os fatos técnicos abaixo refletem o código atual: o checkout guarda e-mail,
 * guia escolhido e status do pagamento; Pix via Mercado Pago; e-mail via
 * Resend; banco e arquivos no Supabase; hospedagem e métricas na Vercel.
 */
export default function PrivacidadePage() {
  return (
    <PaginaInstitucionalLayout pagina="privacidade" titulo="Política de privacidade">
      <p>
        Esta política explica como o {BRAND_NAME} trata os dados pessoais de quem visita o site e compra um guia.
        TODO_REVISAO_JURIDICA: identificação do controlador (nome ou razão social e documento).
      </p>

      <h2>Dados coletados</h2>
      <ul>
        <li>E-mail informado na compra, usado para entregar o guia.</li>
        <li>Guia e trilha escolhidos, valor e situação do pagamento.</li>
        <li>Dados do pagamento Pix, tratados pelo Mercado Pago; o site não recebe dados bancários.</li>
        <li>Métricas de navegação agregadas (páginas vistas e desempenho), sem cadastro.</li>
      </ul>

      <h2>Finalidade e base legal</h2>
      <p>
        Processar a compra, entregar o PDF e o modelo de currículo, prestar suporte e cumprir obrigações legais.
        TODO_REVISAO_JURIDICA: confirmar a base legal de cada finalidade (LGPD, art. 7º).
      </p>

      <h2>Compartilhamento</h2>
      <p>
        Apenas com os fornecedores necessários ao serviço: Mercado Pago (pagamento), Resend (envio de e-mail),
        Supabase (banco de dados e arquivos) e Vercel (hospedagem e métricas). Não vendemos dados.
      </p>

      <h2>Retenção</h2>
      <p>TODO_REVISAO_JURIDICA: prazo de guarda dos pedidos e do e-mail.</p>

      <h2>Seus direitos</h2>
      <p>
        Você pode pedir confirmação, acesso, correção ou exclusão dos seus dados, entre outros direitos da LGPD,
        escrevendo para <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>

      <h2>Cookies</h2>
      <p>TODO_REVISAO_JURIDICA: confirmar o uso de cookies e de métricas de navegação.</p>
    </PaginaInstitucionalLayout>
  );
}
