import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { MercadoPagoConfig, Order } from "mercadopago";
import { getAreaBySlug, PRICE_BRL } from "@/lib/guias";
import { env } from "@/lib/env";
import {
  buildExternalReference,
  buildIdempotencyKey,
  buildPixOrderPayload,
  isoDurationToMs,
} from "@/lib/pix";
import {
  getPedidoByClientToken,
  insertPedido,
  savePixAttempt,
  type Pedido,
} from "@/lib/pedidos";
import { enforceIpRateLimit, readJsonWithLimit, tooLargeResponse } from "@/lib/request-guards";

// Generoso para o payload real (poucos campos curtos) mas longe de um corpo
// "enorme" conseguir consumir memória do processo.
const MAX_BODY_BYTES = 10 * 1024;
// Cada tentativa de Pix bem-sucedida já é idempotente por clientToken+attempt;
// este limite trata o abuso de criar muitos clientTokens novos pelo mesmo IP.
const RATE_LIMIT = { keyPrefix: "pix-create", limit: env.PIX_CREATE_RATE_LIMIT, windowMs: 60_000 };

const bodySchema = z.object({
  area: z.string().min(1),
  trilha: z.enum(["crescer", "mudar"]).nullable().optional(),
  payerEmail: z.string().email(),
  // Gerado pelo navegador no primeiro clique; identifica este pedido sem expor um ID sequencial.
  clientToken: z.string().uuid(),
});

const client = new MercadoPagoConfig({ accessToken: env.MP_ACCESS_TOKEN });

function isExpired(pedido: Pedido): boolean {
  return !pedido.expires_at || new Date(pedido.expires_at).getTime() <= Date.now();
}

export async function POST(req: NextRequest) {
  const rateLimited = enforceIpRateLimit(req, RATE_LIMIT);
  if (rateLimited) return rateLimited;

  const bodyResult = await readJsonWithLimit(req, MAX_BODY_BYTES);
  if (!bodyResult.ok) return tooLargeResponse();

  const parsed = bodySchema.safeParse(bodyResult.data);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados de pedido inválidos." }, { status: 400 });
  }
  const { area: areaSlug, trilha, payerEmail, clientToken } = parsed.data;

  const area = getAreaBySlug(areaSlug);
  if (!area) {
    return NextResponse.json({ error: "Área inválida." }, { status: 400 });
  }

  try {
    const existing = await getPedidoByClientToken(clientToken);

    if (existing?.status === "pago") {
      return NextResponse.json({ error: "Este pedido já foi pago." }, { status: 409 });
    }

    // Replay do mesmo pedido ainda dentro da validade: devolve o Pix já gerado,
    // sem criar uma nova order na Mercado Pago.
    if (existing && existing.status === "pendente" && !isExpired(existing)) {
      return NextResponse.json({
        pedidoId: existing.client_token,
        qrCode: existing.qr_code,
        qrCodeBase64: existing.qr_code_base64,
        ticketUrl: existing.ticket_url,
        expiresAt: existing.expires_at,
      });
    }

    const attempt = existing ? existing.attempt + 1 : 1;
    const externalReference = buildExternalReference(clientToken, attempt);
    const idempotencyKey = buildIdempotencyKey(clientToken, attempt);

    const order = new Order(client);
    const result = await order.create({
      body: buildPixOrderPayload({
        externalReference,
        payerEmail,
        expiration: env.MP_PIX_EXPIRATION,
      }),
      requestOptions: { idempotencyKey },
    });

    const payment = result.transactions?.payments?.[0];
    const paymentMethod = payment?.payment_method;
    if (!result.id || !paymentMethod?.qr_code_base64) {
      console.error("Resposta da Mercado Pago sem QR code Pix:", {
        mpOrderId: result.id,
        status: payment?.status,
        statusDetail: payment?.status_detail,
      });
      return NextResponse.json(
        { error: "Não foi possível gerar o Pix. Tente novamente em instantes." },
        { status: 502 }
      );
    }

    const mpOrderId = result.id;
    const expiresAt = new Date(Date.now() + isoDurationToMs(env.MP_PIX_EXPIRATION));

    const pedido = existing
      ? await savePixAttempt({
          id: existing.id,
          attempt,
          externalReference,
          mpOrderId,
          qrCode: paymentMethod.qr_code ?? null,
          qrCodeBase64: paymentMethod.qr_code_base64 ?? null,
          ticketUrl: paymentMethod.ticket_url ?? null,
          expiresAt,
        })
      : await (async () => {
          const created = await insertPedido({
            clientToken,
            externalReference,
            areaSlug: area.slug,
            trilha: trilha ?? null,
            payerEmail,
            amount: PRICE_BRL,
          });
          return savePixAttempt({
            id: created.id,
            attempt,
            externalReference,
            mpOrderId,
            qrCode: paymentMethod.qr_code ?? null,
            qrCodeBase64: paymentMethod.qr_code_base64 ?? null,
            ticketUrl: paymentMethod.ticket_url ?? null,
            expiresAt,
          });
        })();

    console.log("[pix] pedido criado", { pedidoId: pedido.id, mpOrderId: pedido.mp_order_id, attempt });

    return NextResponse.json({
      pedidoId: pedido.client_token,
      qrCode: pedido.qr_code,
      qrCodeBase64: pedido.qr_code_base64,
      ticketUrl: pedido.ticket_url,
      expiresAt: pedido.expires_at,
    });
  } catch (err) {
    console.error("Erro ao criar order Pix na Mercado Pago:", err);
    return NextResponse.json(
      { error: "Não foi possível gerar o Pix. Tente novamente em instantes." },
      { status: 500 }
    );
  }
}
