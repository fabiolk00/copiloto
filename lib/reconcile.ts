import { getPedidoByMpOrderId, markPedidoStatus } from "@/lib/pedidos";
import { amountsMatch, mapMpPaymentStatus } from "@/lib/pix";

/** Forma mínima da order da Mercado Pago de que a regra de status precisa. */
type OrderLike = {
  transactions?: {
    payments?: { status?: string; status_detail?: string; amount?: string }[];
  };
};

export type ApplyOrderOutcome = "sem_pedido" | "valor_divergente" | "atualizado" | "sem_mudanca";

/**
 * Aplica o estado REAL de uma order da Mercado Pago (lido da API, nunca do
 * corpo do webhook) ao pedido correspondente. Única fonte da regra de status,
 * usada tanto pelo webhook quanto pela reconciliação por cron.
 *
 * Idempotente: `markPedidoStatus` só sai de `pendente`, então reaplicar o
 * mesmo resultado é um no-op seguro.
 */
export async function applyMpOrder(mpOrderId: string, order: OrderLike): Promise<ApplyOrderOutcome> {
  const payment = order.transactions?.payments?.[0];

  const pedido = await getPedidoByMpOrderId(mpOrderId);
  if (!pedido) {
    console.warn("[webhook] order sem pedido correspondente no banco", { mpOrderId });
    return "sem_pedido";
  }

  const nextStatus = mapMpPaymentStatus(payment?.status, payment?.status_detail);
  if (nextStatus === "pago" && !amountsMatch(payment?.amount, pedido.amount)) {
    console.error("[webhook] valor da order não corresponde ao pedido — pagamento não confirmado", {
      pedidoId: pedido.id,
      mpOrderId,
      orderAmount: payment?.amount,
      pedidoAmount: pedido.amount,
    });
    return "valor_divergente";
  }

  if (nextStatus) {
    // `markPedidoStatus` devolve a linha só se a transição foi permitida; um
    // replay ou uma transição vetada (ex.: cancelado sobre expirado) não muda nada.
    const changed = await markPedidoStatus(mpOrderId, nextStatus);
    if (changed) {
      console.log("[webhook] pedido atualizado", { pedidoId: pedido.id, mpOrderId, status: nextStatus });
      return "atualizado";
    }
  }

  return "sem_mudanca";
}
