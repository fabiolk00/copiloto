import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { aplicarEventoResend, pedidoExistePorResendEmailId } from "@/lib/email-queue";
import { markWebhookEventProcessed, recordWebhookEventOnce } from "@/lib/pedidos";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { verifyResendWebhook } from "@/lib/resend-signature";

const MAX_BODY_BYTES = 64 * 1024;
const RATE_LIMIT = { limit: 120, windowMs: 60_000 };

/** Lê o corpo como texto BRUTO (a assinatura cobre os bytes exatos), com limite de tamanho. */
async function readRawWithLimit(req: Request, maxBytes: number): Promise<string | null> {
  const declared = req.headers.get("content-length");
  if (declared && Number(declared) > maxBytes) return null;
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf8");
}

// Respostas sem corpo, de propósito: quem lê é o Svix e só olha o status.
export async function POST(req: NextRequest) {
  // Sem o segredo configurado a rota nem existe.
  if (!env.RESEND_WEBHOOK_SECRET) return new NextResponse(null, { status: 404 });

  const rate = checkRateLimit(`resend-webhook:${getClientIp(req)}`, RATE_LIMIT.limit, RATE_LIMIT.windowMs);
  if (!rate.allowed) {
    return new NextResponse(null, { status: 429, headers: { "Retry-After": String(Math.ceil((rate.resetAt - Date.now()) / 1000)) } });
  }

  const rawBody = await readRawWithLimit(req, MAX_BODY_BYTES);
  if (rawBody === null) return new NextResponse(null, { status: 413 });

  const svixId = req.headers.get("svix-id");
  const verification = verifyResendWebhook({
    rawBody,
    svixId,
    svixTimestamp: req.headers.get("svix-timestamp"),
    svixSignature: req.headers.get("svix-signature"),
    secret: env.RESEND_WEBHOOK_SECRET,
  });
  if (!verification.ok) {
    console.warn("[resend-webhook] assinatura inválida", { reason: verification.reason });
    return new NextResponse(null, { status: 400 });
  }

  let payload: { type?: unknown; data?: { email_id?: unknown; bounce?: { type?: unknown } } } | null;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  const type = typeof payload?.type === "string" ? payload.type : "";
  const emailId = typeof payload?.data?.email_id === "string" ? payload.data.email_id : "";
  if (!type || !emailId || !svixId) return new NextResponse(null, { status: 400 });

  // Só estes tipos mudam estado; o resto é reconhecido e descartado.
  const evento: "delivered" | "rejeitado" | null =
    type === "email.delivered"
      ? "delivered"
      : type === "email.complained"
        ? "rejeitado"
        : type === "email.bounced"
          ? // Bounce temporário (caixa cheia, etc.) não é definitivo: não paramos o fluxo.
            String(payload?.data?.bounce?.type ?? "").toLowerCase() === "transient"
            ? null
            : "rejeitado"
          : null;
  if (!evento) return new NextResponse(null, { status: 200 });

  // O pedido precisa existir ANTES de registrar o evento: se o webhook chegou
  // antes de gravarmos o resend_email_id, respondemos não-2xx para o Svix
  // reentregar. Registrar antes faria a reentrega ser descartada como duplicada.
  if (!(await pedidoExistePorResendEmailId(emailId))) {
    return new NextResponse(null, { status: 404 });
  }

  // At-least-once: deduplica por svix-id, no mesmo padrão do webhook da Mercado Pago.
  const eventKey = `resend:${svixId}`;
  try {
    if (!(await recordWebhookEventOnce(eventKey, type, emailId))) {
      return new NextResponse(null, { status: 200 });
    }
    await aplicarEventoResend(emailId, evento, type);
    await markWebhookEventProcessed(eventKey);
    return new NextResponse(null, { status: 200 });
  } catch (err) {
    console.error("[resend-webhook] falha ao processar", err instanceof Error ? err.message : "erro desconhecido");
    return new NextResponse(null, { status: 500 });
  }
}
