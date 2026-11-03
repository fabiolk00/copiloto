/**
 * Fila (outbox) do e-mail do guia. O estado vive em colunas de `pedidos`
 * (migration 20261104120000). O pedido entra na fila na MESMA instrução que o
 * marca como pago (markPedidoStatus). Este módulo reivindica, envia e fecha.
 *
 * Garantias:
 * - reivindicação atômica com `FOR UPDATE SKIP LOCKED` e lease de 5 min: se o
 *   processo morrer enviando, a linha volta a ser elegível;
 * - chave de idempotência estável por pedido (`guia-pago/{id}`) e por reenvio
 *   (`guia-reenvio/{id}/{n}`), com corpo idêntico entre tentativas;
 * - nenhuma URL assinada no e-mail: o link aponta para /guia, que assina no clique;
 * - nada de e-mail completo, link ou token em log.
 */
import { sql } from "@/lib/db";
import { env } from "@/lib/env";
import { buildGuiaLink, buildLogoUrl, renderGuiaEmail } from "@/lib/email-template";
import { hasHeaderInjection, maskEmail, sendEmailViaResend, type EmailSender } from "@/lib/email";

export const MAX_TENTATIVAS = 6;
/** Espera (minutos) depois da tentativa n falhar, n = 1..5. Soma ~4h20, bem dentro das 24 h da chave de idempotência. */
export const BACKOFF_MINUTOS = [1, 5, 15, 60, 180] as const;
export const LEASE_MINUTOS = 5;
export const MAX_REENVIOS = 3;
export const INTERVALO_REENVIO_MIN = 2;
const PAUSA_CONFIGURACAO_S = 15 * 60;
const PAUSA_COTA_S = 60 * 60;
const TAXA_RETRY_PADRAO_S = 5;
/** Depois deste tempo na execução não começamos outro envio (pg_net corta em 8 s e a função serverless tem teto). */
const ORCAMENTO_MS = 8_000;

export function backoffSegundos(tentativaQueFalhou: number, rand: () => number = Math.random): number {
  const idx = Math.min(Math.max(tentativaQueFalhou, 1), BACKOFF_MINUTOS.length) - 1;
  const base = BACKOFF_MINUTOS[idx] * 60;
  // Jitter de -10% a +10% para as retentativas não marcharem juntas.
  return Math.round(base * (0.9 + rand() * 0.2));
}

export type EmailClaim = {
  id: number;
  client_token: string;
  payer_email: string;
  area_slug: string;
  trilha: string | null;
  email_tentativas: number;
  email_reenvios: number;
};

/** Reivindica UM pedido por vez, de forma atômica. */
export async function claimNextEmail(): Promise<EmailClaim | undefined> {
  const [row] = await sql<EmailClaim[]>`
    update pedidos set
      email_status = 'enviando',
      email_lock_ate = now() + ${LEASE_MINUTOS}::int * interval '1 minute',
      email_tentativas = email_tentativas + 1
    where id in (
      select id from pedidos
      where status = 'pago'
        and (
          (email_status = 'pendente' and email_proxima_tentativa <= now())
          or (email_status = 'enviando' and email_lock_ate < now())
        )
      order by email_proxima_tentativa asc nulls first, id asc
      limit 1
      for update skip locked
    )
    returning id, client_token, payer_email, area_slug, trilha, email_tentativas, email_reenvios
  `;
  return row;
}

async function marcarEnviado(id: number, resendEmailId: string): Promise<void> {
  await sql`
    update pedidos set
      email_status = 'enviado',
      resend_email_id = ${resendEmailId},
      email_enviado_em = now(),
      email_lock_ate = null,
      email_ultimo_erro = null
    where id = ${id} and email_status = 'enviando'
  `;
}

async function agendarNovaTentativa(
  id: number,
  delaySegundos: number,
  consomeTentativa: boolean,
  erro: string
): Promise<void> {
  await sql`
    update pedidos set
      email_status = 'pendente',
      email_proxima_tentativa = now() + ${Math.max(1, Math.round(delaySegundos))}::int * interval '1 second',
      email_lock_ate = null,
      email_ultimo_erro = ${erro.slice(0, 200)},
      email_tentativas = case when ${consomeTentativa} then email_tentativas else greatest(email_tentativas - 1, 0) end
    where id = ${id} and email_status = 'enviando'
  `;
}

async function marcarFalhou(id: number, erro: string): Promise<void> {
  await sql`
    update pedidos set
      email_status = 'falhou',
      email_lock_ate = null,
      email_ultimo_erro = ${erro.slice(0, 200)}
    where id = ${id} and email_status = 'enviando'
  `;
}

export type EmailRunSummary = {
  enviados: number;
  agendados: number;
  falhas: number;
  /** Por que a execução parou antes de esvaziar a fila, quando parou. */
  pausa?: "taxa" | "cota" | "configuracao" | "orcamento";
};

export async function processEmailQueue(opts: {
  sender?: EmailSender;
  limit?: number;
  budgetMs?: number;
  appUrl?: string | undefined;
  now?: () => number;
  rand?: () => number;
} = {}): Promise<EmailRunSummary> {
  const sender = opts.sender ?? sendEmailViaResend;
  const limit = opts.limit ?? env.EMAIL_BATCH_SIZE;
  const budgetMs = opts.budgetMs ?? ORCAMENTO_MS;
  const now = opts.now ?? Date.now;
  const appUrl = opts.appUrl ?? env.APP_URL;
  const inicio = now();
  const summary: EmailRunSummary = { enviados: 0, agendados: 0, falhas: 0 };

  for (let i = 0; i < limit; i += 1) {
    if (now() - inicio > budgetMs) {
      summary.pausa = "orcamento";
      break;
    }

    const claim = await claimNextEmail();
    if (!claim) break;

    const tag = { pedidoId: claim.id, tentativa: claim.email_tentativas, email: maskEmail(claim.payer_email) };

    if (claim.email_tentativas > MAX_TENTATIVAS) {
      await marcarFalhou(claim.id, "tentativas_esgotadas");
      summary.falhas += 1;
      console.error("[email] tentativas esgotadas", tag);
      continue;
    }

    if (!appUrl) {
      await agendarNovaTentativa(claim.id, PAUSA_CONFIGURACAO_S, false, "configuracao: APP_URL ausente");
      summary.agendados += 1;
      summary.pausa = "configuracao";
      console.error("[email] configuração ausente: APP_URL", tag);
      break;
    }

    if (hasHeaderInjection(claim.payer_email)) {
      await marcarFalhou(claim.id, "permanente: destinatário inválido");
      summary.falhas += 1;
      console.error("[email] destinatário com caractere de controle", { pedidoId: claim.id });
      continue;
    }

    const mensagem = renderGuiaEmail({
      areaSlug: claim.area_slug,
      trilha: claim.trilha,
      link: buildGuiaLink(appUrl, claim.client_token),
      logoUrl: buildLogoUrl(appUrl),
    });
    const idempotencyKey =
      claim.email_reenvios > 0 ? `guia-reenvio/${claim.id}/${claim.email_reenvios}` : `guia-pago/${claim.id}`;

    const result = await sender({ to: claim.payer_email, ...mensagem, idempotencyKey });

    if (result.ok) {
      await marcarEnviado(claim.id, result.id);
      summary.enviados += 1;
      continue;
    }

    switch (result.kind) {
      case "transitorio": {
        if (claim.email_tentativas >= MAX_TENTATIVAS) {
          await marcarFalhou(claim.id, `tentativas_esgotadas: ${result.detail}`);
          summary.falhas += 1;
          console.error("[email] tentativas esgotadas", { ...tag, detalhe: result.detail });
        } else {
          const delay = Math.max(backoffSegundos(claim.email_tentativas, opts.rand), result.retryAfterSec ?? 0);
          await agendarNovaTentativa(claim.id, delay, true, `transitorio: ${result.detail}`);
          summary.agendados += 1;
          console.warn("[email] falha transitória, nova tentativa agendada", { ...tag, detalhe: result.detail, emSegundos: delay });
        }
        break;
      }
      case "permanente": {
        await marcarFalhou(claim.id, `permanente: ${result.detail}`);
        summary.falhas += 1;
        console.error("[email] falha permanente (revisar: provável bug nosso)", { ...tag, detalhe: result.detail });
        break;
      }
      case "taxa": {
        await agendarNovaTentativa(claim.id, result.retryAfterSec ?? TAXA_RETRY_PADRAO_S, false, "taxa: 429");
        summary.agendados += 1;
        summary.pausa = "taxa";
        console.warn("[email] limite de taxa do Resend; pausando a execução", { ...tag, retryAfterSec: result.retryAfterSec });
        return summary;
      }
      case "cota": {
        await agendarNovaTentativa(claim.id, result.retryAfterSec ?? PAUSA_COTA_S, false, `cota: ${result.detail}`);
        summary.agendados += 1;
        summary.pausa = "cota";
        console.error("[email] COTA do Resend esgotada; fila pausada", { ...tag, detalhe: result.detail });
        return summary;
      }
      case "configuracao": {
        await agendarNovaTentativa(claim.id, PAUSA_CONFIGURACAO_S, false, `configuracao: ${result.detail}`);
        summary.agendados += 1;
        summary.pausa = "configuracao";
        console.error("[email] erro de CONFIGURAÇÃO do Resend; fila pausada", { ...tag, detalhe: result.detail });
        return summary;
      }
    }
  }

  return summary;
}

// ---------------------------------------------------------------------------
// Reenvio manual (tela do cliente)
// ---------------------------------------------------------------------------

export type ReenvioResultado =
  | { tipo: "enfileirado" }
  | { tipo: "em_andamento" }
  | { tipo: "nao_encontrado" }
  | { tipo: "rejeitado" }
  | { tipo: "limite" }
  | { tipo: "aguarde"; segundos: number };

/**
 * Pede um reenvio. A checagem de limite (3), o intervalo (2 min) e o
 * incremento do contador são UM único UPDATE condicional: dois cliques ao mesmo
 * tempo não passam os dois. O destinatário é sempre o payer_email já gravado.
 */
export async function solicitarReenvio(clientToken: string): Promise<ReenvioResultado> {
  const atualizados = await sql<{ id: number }[]>`
    update pedidos set
      email_status = 'pendente',
      email_proxima_tentativa = now(),
      email_tentativas = 0,
      email_lock_ate = null,
      email_ultimo_erro = null,
      email_reenvios = email_reenvios + 1,
      email_ultimo_reenvio_em = now()
    where client_token = ${clientToken}
      and status = 'pago'
      and email_status in ('enviado', 'entregue', 'falhou')
      and email_reenvios < ${MAX_REENVIOS}
      and (email_ultimo_reenvio_em is null
           or email_ultimo_reenvio_em <= now() - ${INTERVALO_REENVIO_MIN}::int * interval '1 minute')
    returning id
  `;
  if (atualizados.length > 0) return { tipo: "enfileirado" };

  const [p] = await sql<
    { status: string; email_status: string | null; email_reenvios: number; espera: number | null }[]
  >`
    select status, email_status, email_reenvios,
           case when email_ultimo_reenvio_em is null then null
                else extract(epoch from (email_ultimo_reenvio_em + ${INTERVALO_REENVIO_MIN}::int * interval '1 minute' - now()))::float8
           end as espera
    from pedidos where client_token = ${clientToken} limit 1
  `;
  // Mesma resposta para token inexistente e para pedido não pago (sem enumeração).
  if (!p || p.status !== "pago") return { tipo: "nao_encontrado" };
  if (p.email_status === "rejeitado") return { tipo: "rejeitado" };
  if (p.email_status === "pendente" || p.email_status === "enviando" || p.email_status === null) {
    return { tipo: "em_andamento" };
  }
  if (p.email_reenvios >= MAX_REENVIOS) return { tipo: "limite" };
  return { tipo: "aguarde", segundos: Math.max(1, Math.ceil(p.espera ?? INTERVALO_REENVIO_MIN * 60)) };
}

// ---------------------------------------------------------------------------
// Eventos do webhook do Resend
// ---------------------------------------------------------------------------

export async function pedidoExistePorResendEmailId(resendEmailId: string): Promise<boolean> {
  const rows = await sql`select 1 from pedidos where resend_email_id = ${resendEmailId} limit 1`;
  return rows.length > 0;
}

/**
 * Só avança, nunca regride:
 *   delivered: enviado -> entregue (ignora se já entregue, rejeitado ou refazendo envio)
 *   bounced definitivo / complained: enviado|entregue -> rejeitado (terminal, para o retry)
 */
export async function aplicarEventoResend(
  resendEmailId: string,
  evento: "delivered" | "rejeitado",
  motivo: string
): Promise<boolean> {
  if (evento === "delivered") {
    const rows = await sql`
      update pedidos set email_status = 'entregue', email_entregue_em = now()
      where resend_email_id = ${resendEmailId} and email_status = 'enviado'
      returning id
    `;
    return rows.length > 0;
  }
  const rows = await sql`
    update pedidos set email_status = 'rejeitado', email_lock_ate = null, email_ultimo_erro = ${motivo.slice(0, 200)}
    where resend_email_id = ${resendEmailId} and email_status in ('enviado', 'entregue')
    returning id
  `;
  return rows.length > 0;
}
