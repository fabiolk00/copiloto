import { PRICE_BRL } from "@/lib/guias";
import type { PedidoStatus } from "@/lib/pedidos";

/**
 * Parses a small subset of ISO 8601 durations (`P[nD]T[nH][nM][nS]`) into
 * milliseconds. Covers everything Mercado Pago accepts for Pix
 * `expiration_time` (30 minutes to 30 days) without pulling in a date library.
 */
export function isoDurationToMs(duration: string): number {
  const match = duration.match(
    /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/
  );
  if (!match) {
    throw new Error(`Duração ISO 8601 inválida: ${duration}`);
  }
  const [, days, hours, minutes, seconds] = match;
  const ms =
    (Number(days ?? 0) * 24 * 60 * 60 +
      Number(hours ?? 0) * 60 * 60 +
      Number(minutes ?? 0) * 60 +
      Number(seconds ?? 0)) *
    1000;
  return ms;
}

/** external_reference é validado pela Mercado Pago contra um padrão que não aceita ":" — só "-". */
export function buildExternalReference(clientToken: string, attempt: number): string {
  return `${clientToken}-a${attempt}`;
}

/** Estável por pedido+tentativa — reenviar a mesma tentativa nunca cria uma order duplicada na Mercado Pago. */
export function buildIdempotencyKey(clientToken: string, attempt: number): string {
  return `pix-order:${clientToken}:${attempt}`;
}

/**
 * Corpo da order Pix enviado à Mercado Pago. O preço vem sempre de
 * `PRICE_BRL` — a função não aceita nem olha para nenhum valor vindo do
 * cliente.
 */
export function buildPixOrderPayload(params: {
  externalReference: string;
  payerEmail: string;
  expiration: string;
}) {
  return {
    type: "online" as const,
    processing_mode: "automatic" as const,
    total_amount: PRICE_BRL.toFixed(2),
    external_reference: params.externalReference,
    payer: { email: params.payerEmail },
    transactions: {
      payments: [
        {
          amount: PRICE_BRL.toFixed(2),
          payment_method: { id: "pix", type: "bank_transfer" },
          expiration_time: params.expiration,
        },
      ],
    },
  };
}

/**
 * Mapeia o status de pagamento da Mercado Pago para o status interno do
 * pedido. `null` = ainda não é um estado final.
 *
 * Confirmado contra a Orders API real: um Pix pago chega como status
 * "processed" + status_detail "accredited" — não "approved" (isso só é
 * assim na Payments API).
 */
export function mapMpPaymentStatus(
  status: string | undefined,
  statusDetail: string | undefined
): Exclude<PedidoStatus, "pendente" | "expirado"> | null {
  if (status === "approved" || (status === "processed" && statusDetail === "accredited")) {
    return "pago";
  }
  if (status === "rejected") return "falhou";
  if (status === "cancelled") return "cancelado";
  // action_required / waiting_transfer / unknown — ainda não é um estado final.
  return null;
}

/**
 * Compara o valor informado pela Mercado Pago (string decimal, ex.: "29.90")
 * com o valor do pedido no banco. Usa tolerância de meio centavo para
 * absorver diferenças de representação ponto-flutuante/string.
 */
export function amountsMatch(
  mpAmount: string | undefined,
  pedidoAmount: string
): boolean {
  if (!mpAmount) return false;
  const a = Number(mpAmount);
  const b = Number(pedidoAmount);
  if (Number.isNaN(a) || Number.isNaN(b)) return false;
  return Math.abs(a - b) < 0.005;
}
