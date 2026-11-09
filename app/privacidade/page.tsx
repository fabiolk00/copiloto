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
 * RASCUNHO. Só publicar após revisão jurídica do dono
 * (PAGINAS_INSTITUCIONAIS.privacidade.publicada). Os fatos técnicos refletem
 * o código atual: o checkout guarda e-mail, guia e trilha escolhidos, valor e
 * situação do pagamento; Pix via Mercado Pago; e-mail via Resend; banco e
 * arquivos no Supabase; hospedagem e métricas (Vercel Web Analytics) na Vercel.
 */
export default function PrivacidadePage() {
  return (
    <PaginaInstitucionalLayout pagina="privacidade" titulo="Política de privacidade">
      <p>
        Esta política explica como o {BRAND_NAME} trata os dados pessoais de quem visita o site e compra um guia.
        Controlador: TODO_REVISAO_JURIDICA (nome ou razão social e documento).
      </p>

      <h2>Dados coletados</h2>
      <ul>
        <li>E-mail informado na compra.</li>
        <li>Guia e trilha escolhidos, valor, identificador e situação do pagamento.</li>
        <li>Dados do pagamento Pix, tratados pelo Mercado Pago; o site não recebe dados bancários.</li>
        <li>Métricas de navegação agregadas (páginas vistas e desempenho), sem cadastro.</li>
      </ul>

      <h2>Finalidades</h2>
      <ul>
        <li>Processar o pagamento e confirmar a compra.</li>
        <li>Entregar o guia em PDF e o modelo de currículo por e-mail, e reenviar quando solicitado.</li>
        <li>Prestar suporte e responder mensagens.</li>
        <li>Medir o uso e o desempenho do site de forma agregada.</li>
        <li>Cumprir obrigações legais e prevenir fraudes.</li>
      </ul>

      <h2>Base legal</h2>
      <p>
        TODO_REVISAO_JURIDICA: indicar a base legal de cada finalidade (LGPD, art. 7º), por exemplo execução de
        contrato para a entrega do guia e cumprimento de obrigação legal para registros fiscais.
      </p>

      <h2>Compartilhamento</h2>
      <p>
        Apenas com os fornecedores necessários ao serviço: Mercado Pago (pagamento), Resend (envio de e-mail),
        Supabase (banco de dados e arquivos) e Vercel (hospedagem e métricas). Não vendemos dados pessoais.
      </p>

      <h2>Transferência internacional</h2>
      <p>
        Parte desses fornecedores opera ou armazena dados fora do Brasil, o que pode implicar transferência
        internacional de dados pessoais. TODO_REVISAO_JURIDICA: confirmar os países e a região de cada fornecedor e o
        mecanismo que fundamenta a transferência (LGPD, art. 33).
      </p>

      <h2>Retenção</h2>
      <p>TODO_REVISAO_JURIDICA: prazo de guarda dos pedidos, do e-mail e dos registros de envio.</p>

      <h2>Direitos do titular</h2>
      <p>
        Pela LGPD (art. 18), você pode pedir confirmação do tratamento, acesso, correção, anonimização, bloqueio ou
        eliminação de dados desnecessários, portabilidade, informação sobre compartilhamento e revisão de
        consentimento, quando aplicável. Também pode apresentar reclamação à ANPD. TODO_REVISAO_JURIDICA: prazo de
        resposta.
      </p>

      <h2>Cookies</h2>
      <p>TODO_REVISAO_JURIDICA: confirmar o uso de cookies e de métricas de navegação.</p>

      <h2>Contato</h2>
      <p>
        Para exercer seus direitos ou tirar dúvidas: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        Encarregado (DPO): TODO_REVISAO_JURIDICA.
      </p>
    </PaginaInstitucionalLayout>
  );
}
