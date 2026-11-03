import crypto from "node:crypto";

/**
 * Reconstrói a assinatura HMAC-SHA256 que a Mercado Pago envia no header
 * `x-signature`, usando exatamente o mesmo manifesto que
 * `WebhookSignatureValidator` recomputa
 * (node_modules/mercadopago/dist/utils/webhook/index.js#buildManifest):
 * `id:{dataId};request-id:{requestId};ts:{ts};`.
 *
 * Gerar a assinatura real em vez de mockar o validador deixa os testes de
 * assinatura inválida/expirada fiéis ao comportamento de produção.
 */
export function buildSignatureHeader(params: {
  dataId: string;
  requestId: string;
  secret: string;
  ts?: number;
}): { xSignature: string; xRequestId: string; ts: number } {
  const ts = params.ts ?? Math.floor(Date.now() / 1000);
  const manifest = `id:${params.dataId};request-id:${params.requestId};ts:${ts};`;
  const hash = crypto.createHmac("sha256", params.secret).update(manifest).digest("hex");
  return {
    xSignature: `ts=${ts},v1=${hash}`,
    xRequestId: params.requestId,
    ts,
  };
}
