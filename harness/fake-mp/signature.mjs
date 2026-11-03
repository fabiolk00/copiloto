import crypto from "node:crypto";

/**
 * Mesmo algoritmo do SDK oficial (node_modules/mercadopago/dist/utils/webhook/index.js
 * #buildManifest): `id:{dataId};request-id:{requestId};ts:{ts};`, HMAC-SHA256
 * com o segredo do webhook. Duplicado aqui (em vez de importado) porque este
 * arquivo roda como processo Node standalone fora do grafo de módulos do app/testes.
 */
export function signWebhook({ dataId, requestId, secret, ts }) {
  const timestamp = ts ?? Math.floor(Date.now() / 1000);
  const manifest = `id:${dataId};request-id:${requestId};ts:${timestamp};`;
  const hash = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
  return { xSignature: `ts=${timestamp},v1=${hash}`, ts: timestamp };
}
