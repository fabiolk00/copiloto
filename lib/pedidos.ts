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
 * Transitions a pedido out of `pendente`. A replayed/duplicate webhook for an
 * already-settled pedido matches zero rows and is a safe no-op.
 *
 * Única exceção: `expirado` -> `pago`. O job de expiração marca como expirado
 * por relógio, e um pagamento confirmado pela Mercado Pago depois disso (webhook
 * atrasado) precisa vencer a expiração, senão a pessoa paga e não recebe o
 * guia. Nenhum outro status sai de `expirado`, e `pago` nunca é revertido.
 */
export async function markPedidoStatus(
  mpOrderId: string,
  status: PedidoStatus
): Promise<Pedido | undefined> {
  const [row] = await sql<Pedido[]>`
    update pedidos set status = ${status}
    where mp_order_id = ${mpOrderId}
      and (status = 'pendente' or (status = 'expirado' and ${status}::text = 'pago'))
    returning *
  `;
  return row;
}

/**
 * Decide se esta notificação deve ser processada agora. Devolve `true` na
 * primeira vez que o evento é visto, ou quando uma tentativa anterior NÃO foi
 * concluída (processed_at nulo) e já passou a janela de 1 minuto; devolve
 * `false` para um evento já processado ou ainda em andamento.
 *
 * A chave só bloqueia reentregas depois de `markWebhookEventProcessed`. Assim
 * uma falha no meio do processamento não consome o evento: a Mercado Pago
 * reenvia e a nova tentativa é aceita.
 */
export async function recordWebhookEventOnce(
  eventKey: string,
  type: string,
  dataId: string
): Promise<boolean> {
  const rows = await sql`
    insert into pedido_webhook_eventos (event_key, type, data_id)
    values (${eventKey}, ${type}, ${dataId})
    on conflict (event_key) do update set received_at = now()
      where pedido_webhook_eventos.processed_at is null
        and pedido_webhook_eventos.received_at < now() - interval '1 minute'
    returning id
  `;
  return rows.length > 0;
}

/** Marca o evento como concluído; a partir daqui, reentregas são descartadas como duplicadas. */
export async function markWebhookEventProcessed(eventKey: string): Promise<void> {
  await sql`
    update pedido_webhook_eventos set processed_at = now()
    where event_key = ${eventKey} and processed_at is null
  `;
}

export type PedidoParaReconciliar = { id: number; mp_order_id: string; amount: string };

/**
 * Pedidos que a reconciliação deve conferir na Mercado Pago. O critério vive
 * na view `pedidos_a_reconciliar` (migration), a mesma usada pelo disparo no
 * banco, para app e pg_cron nunca divergirem.
 */
export async function getPedidosParaReconciliar(limit: number): Promise<PedidoParaReconciliar[]> {
  return sql<PedidoParaReconciliar[]>`
    select id, mp_order_id, amount
    from pedidos_a_reconciliar
    order by reconciliado_em asc nulls first, id asc
    limit ${limit}
  `;
}

/** Registra que estes pedidos foram conferidos agora, tenham mudado de status ou não. */
export async function markPedidosReconciliados(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  await sql`update pedidos set reconciliado_em = now() where id in ${sql(ids)}`;
}
