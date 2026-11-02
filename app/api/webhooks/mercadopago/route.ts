import { NextRequest, NextResponse } from "next/server";
import { MercadoPagoConfig, Order, WebhookSignatureValidator, InvalidWebhookSignatureError } from "mercadopago";
import { env } from "@/lib/env";
import { getPedidoByMpOrderId, markPedidoStatus, recordWebhookEventOnce } from "@/lib/pedidos";

const client = new MercadoPagoConfig({ accessToken: env.MP_ACCESS_TOKEN });

// Confirmado contra a Orders API real: um Pix pago chega como status "processed" +
// status_detail "accredited" — não "approved" (isso só é assim na Payments API).
function mapPaymentStatus(
  status: string | undefined,
  statusDetail: string | undefined
): "pago" | "falhou" | "cancelado" | null {
  if (status === "approved" || (status === "processed" && statusDetail === "accredited")) {
    return "pago";
  }
  if (status === "rejected") return "falhou";
  if (status === "cancelled") return "cancelado";
  // action_required / waiting_transfer / unknown — ainda não é um estado final.
  return null;
}

export async function POST(req: NextRequest) {
  const xSignature = req.headers.get("x-signature");
  const xRequestId = req.headers.get("x-request-id");
  const dataId = req.nextUrl.searchParams.get("data.id");

  try {
    WebhookSignatureValidator.validate({
      xSignature,
      xRequestId,
      dataId,
      secret: env.MP_WEBHOOK_SECRET,
      toleranceSeconds: 300,
    });
  } catch (err) {
    if (err instanceof InvalidWebhookSignatureError) {
      console.warn("[webhook] assinatura inválida", { reason: err.reason, requestId: xRequestId });
      return new NextResponse(null, { status: 401 });
    }
    throw err;
  }

  const body = await req.json().catch(() => null);
  const type = body?.type as string | undefined;

  if (!dataId || !type) {
    return new NextResponse(null, { status: 400 });
  }

  // Dedup: a mesma notificação pode ser reentregue pela Mercado Pago várias vezes.
  const isNewEvent = await recordWebhookEventOnce(`${type}:${dataId}`, type, dataId);
  if (!isNewEvent) {
    return new NextResponse(null, { status: 200 });
  }

  // Nota de arquitetura: em vez de responder 200 antes de processar e continuar
  // em segundo plano (padrão do servidor Express sempre ligado), este handler
  // roda a verificação de forma síncrona antes de responder. Em uma rota
  // serverless (ex.: Vercel), o processo pode ser finalizado assim que a
  // resposta é enviada — "disparar e esquecer" depois do 200 arriscaria nunca
  // concluir a confirmação do pagamento. A verificação (uma consulta à Orders
  // API + um UPDATE) é rápida e cabe dentro da janela de timeout da Mercado Pago.
  // A documentação bundled chama o tópico "orders", mas o painel registra a
  // subscrição como "order" (singular) — sem nunca ter visto uma entrega real,
  // aceitamos as duas grafias em vez de arriscar descartar notificações reais.
  if (type !== "orders" && type !== "order") {
    return new NextResponse(null, { status: 200 });
  }

  try {
    const order = new Order(client);
    const result = await order.get({ id: dataId });
    const payment = result.transactions?.payments?.[0];

    const pedido = await getPedidoByMpOrderId(dataId);
    if (!pedido) {
      console.warn("[webhook] order sem pedido correspondente no banco", { mpOrderId: dataId });
      return new NextResponse(null, { status: 200 });
    }

    const nextStatus = mapPaymentStatus(payment?.status, payment?.status_detail);
    if (nextStatus) {
      await markPedidoStatus(dataId, nextStatus);
      console.log("[webhook] pedido atualizado", { pedidoId: pedido.id, mpOrderId: dataId, status: nextStatus });
    }

    return new NextResponse(null, { status: 200 });
  } catch (err) {
    console.error("[webhook] falha ao processar notificação", { mpOrderId: dataId, error: String(err) });
    return new NextResponse(null, { status: 500 });
  }
}
