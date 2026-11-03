import { sql } from "@/lib/db";

export type PedidoStatus = "pendente" | "pago" | "cancelado" | "expirado" | "falhou";

export type Pedido = {
  id: number;
  client_token: string;
  external_reference: string;
  area_slug: string;
  trilha: string | null;
  payer_email: string;
  amount: string;
  currency: string;
  status: PedidoStatus;
  attempt: number;
  mp_order_id: string | null;
  qr_code: string | null;
  qr_code_base64: string | null;
  ticket_url: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function getPedidoByClientToken(clientToken: string): Promise<Pedido | undefined> {
  const [row] = await sql<Pedido[]>`
    select * from pedidos where client_token = ${clientToken} limit 1
  `;
  return row;
}

export async function insertPedido(params: {
  clientToken: string;
  externalReference: string;
  areaSlug: string;
  trilha: string | null;
  payerEmail: string;
  amount: number;
}): Promise<Pedido> {
  const [row] = await sql<Pedido[]>`
    insert into pedidos (client_token, external_reference, area_slug, trilha, payer_email, amount)
    values (
      ${params.clientToken}, ${params.externalReference}, ${params.areaSlug},
      ${params.trilha}, ${params.payerEmail}, ${params.amount}
    )
    returning *
  `;
  return row;
}

/** Overwrites the current Pix attempt in place — only the latest attempt's code is ever payable. */
export async function savePixAttempt(params: {
  id: number;
  areaSlug: string;
  trilha: "crescer" | "mudar";
  attempt: number;
  externalReference: string;
  mpOrderId: string;
  qrCode: string | null;
  qrCodeBase64: string | null;
  ticketUrl: string | null;
  expiresAt: Date;
}): Promise<Pedido> {
  // area e trilha entram na nova tentativa: a entrega usa sempre a escolha da última tentativa.
  const [row] = await sql<Pedido[]>`
    update pedidos set
      area_slug = ${params.areaSlug},
      trilha = ${params.trilha},
      attempt = ${params.attempt},
      external_reference = ${params.externalReference},
      mp_order_id = ${params.mpOrderId},
      qr_code = ${params.qrCode},
      qr_code_base64 = ${params.qrCodeBase64},
      ticket_url = ${params.ticketUrl},
      expires_at = ${params.expiresAt.toISOString()},
      status = 'pendente'
    where id = ${params.id}
    returning *
  `;
  return row;
}

export async function getPedidoStatusByClientToken(
  clientToken: string
): Promise<Pick<Pedido, "status" | "expires_at"> | undefined> {
  const [row] = await sql<Pick<Pedido, "status" | "expires_at">[]>`
    select status, expires_at from pedidos where client_token = ${clientToken} limit 1
  `;
  return row;
}

/** Campos mínimos para decidir a entrega do guia. Não traz dados do pagador nem do Pix. */
export async function getPedidoEntregaByClientToken(
  clientToken: string
): Promise<Pick<Pedido, "status" | "area_slug" | "trilha"> | undefined> {
  const [row] = await sql<Pick<Pedido, "status" | "area_slug" | "trilha">[]>`
    select status, area_slug, trilha from pedidos where client_token = ${clientToken} limit 1
  `;
  return row;
}

export async function getPedidoByMpOrderId(mpOrderId: string): Promise<Pedido | undefined> {
  const [row] = await sql<Pedido[]>`
    select * from pedidos where mp_order_id = ${mpOrderId} limit 1
  `;
  return row;
}

/**
 * Transitions a pedido out of `pendente` only. A replayed/duplicate webhook
 * for an already-settled pedido matches zero rows and is a safe no-op.
 */
export async function markPedidoStatus(
  mpOrderId: string,
  status: PedidoStatus
): Promise<Pedido | undefined> {
  const [row] = await sql<Pedido[]>`
    update pedidos set status = ${status}
    where mp_order_id = ${mpOrderId} and status = 'pendente'
    returning *
  `;
  return row;
}

/** Returns `true` the first time this webhook event is seen, `false` on any redelivery. */
export async function recordWebhookEventOnce(
  eventKey: string,
  type: string,
  dataId: string
): Promise<boolean> {
  const rows = await sql`
    insert into pedido_webhook_eventos (event_key, type, data_id)
    values (${eventKey}, ${type}, ${dataId})
    on conflict (event_key) do nothing
    returning id
  `;
  return rows.length > 0;
}

/**
 * Registra uma notificação para reprocessamento posterior quando a consulta
 * à Orders API falhou (rede, 5xx, order não encontrada). Como o evento já
 * foi consumido por `recordWebhookEventOnce`, uma redelivery da Mercado Pago
 * não tentaria de novo sem este registro — um worker futuro (fora do escopo
 * daqui) é quem lê esta tabela e tenta de novo.
 */
export async function scheduleWebhookReprocessing(
  eventKey: string,
  type: string,
  dataId: string,
  reason: string
): Promise<void> {
  await sql`
    insert into pedido_webhook_reprocessamentos (event_key, type, data_id, reason)
    values (${eventKey}, ${type}, ${dataId}, ${reason})
    on conflict (event_key) do nothing
  `;
}
