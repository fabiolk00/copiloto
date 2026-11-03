import { NextRequest, NextResponse } from "next/server";
import { MercadoPagoConfig, Order, WebhookSignatureValidator, InvalidWebhookSignatureError } from "mercadopago";
import { env } from "@/lib/env";
import {
  getPedidoByMpOrderId,
  markPedidoStatus,
  recordWebhookEventOnce,
  scheduleWebhookReprocessing,
} from "@/lib/pedidos";
import { amountsMatch, mapMpPaymentStatus } from "@/lib/pix";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { readJsonWithLimit } from "@/lib/request-guards";

const client = new MercadoPagoConfig({ accessToken: env.MP_ACCESS_TOKEN });

const MAX_BODY_BYTES = 256 * 1024; // generoso para o payload real da Orders API, longe de um corpo "enorme"
// Mais alto que o de /api/pix/create: é o endpoint que a própria Mercado
// Pago chama (pode reentregar e rajar um pouco mais), não um usuário final.
const RATE_LIMIT = { limit: env.MP_WEBHOOK_RATE_LIMIT, windowMs: 60_000 };

export async function POST(req: NextRequest) {
  // Corpo sem conteúdo em toda resposta deste endpoint, de propósito: é a
  // Mercado Pago quem lê, e ela só olha o status HTTP.
  const rateLimit = checkRateLimit(`mp-webhook:${getClientIp(req)}`, RATE_LIMIT.limit, RATE_LIMIT.windowMs);
  if (!rateLimit.allowed) {
    return new NextResponse(null, { status: 429, headers: { "Retry-After": String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) } });
  }

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

  const bodyResult = await readJsonWithLimit(req, MAX_BODY_BYTES);
  if (!bodyResult.ok) return new NextResponse(null, { status: 413 });
  const body = bodyResult.data as { type?: string; action?: string } | null;
  const type = body?.type as string | undefined;
  // `data.id` é o id da ORDER e não muda ao longo de todo o ciclo de vida
  // dela — ele por si só não distingue duas notificações diferentes sobre a
  // mesma order (ex.: "criada" vs. "paga"). O corpo real documentado pela
  // Mercado Pago não traz um id de notificação próprio; quem muda entre
  // eventos distintos é o campo `action` (ex.: "order.created",
  // "order.processed"). Uma redelivery de verdade reenvia a mesma `action`.
  const action = (body?.action as string | undefined) ?? "unknown";

  if (!dataId || !type) {
    return new NextResponse(null, { status: 400 });
  }

  // Dedup: a mesma notificação pode ser reentregue pela Mercado Pago várias vezes.
  const eventKey = `${type}:${dataId}:${action}`;
  const isNewEvent = await recordWebhookEventOnce(eventKey, type, dataId);
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

  let result;
  try {
    const order = new Order(client);
    result = await order.get({ id: dataId });
  } catch (err) {
    // GET falhou (rede, 5xx, order não encontrada na Mercado Pago). Devolvemos 200
    // para a Mercado Pago não reentregar — o dedup acima já consumiu este evento —
    // e agendamos reprocessamento para um worker tentar de novo mais tarde.
    console.warn("[webhook] falha ao consultar order na Mercado Pago, agendando reprocessamento", {
      mpOrderId: dataId,
      error: String(err),
    });
    await scheduleWebhookReprocessing(eventKey, type, dataId, String(err));
    return new NextResponse(null, { status: 200 });
  }

  try {
    const payment = result.transactions?.payments?.[0];

    const pedido = await getPedidoByMpOrderId(dataId);
    if (!pedido) {
      console.warn("[webhook] order sem pedido correspondente no banco", { mpOrderId: dataId });
      return new NextResponse(null, { status: 200 });
    }

    const nextStatus = mapMpPaymentStatus(payment?.status, payment?.status_detail);
    if (nextStatus === "pago" && !amountsMatch(payment?.amount, pedido.amount)) {
      console.error("[webhook] valor da order não corresponde ao pedido — pagamento não confirmado", {
        pedidoId: pedido.id,
        mpOrderId: dataId,
        orderAmount: payment?.amount,
        pedidoAmount: pedido.amount,
      });
      return new NextResponse(null, { status: 200 });
    }

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
