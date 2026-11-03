/**
 * Verificação de assinatura dos webhooks do Resend (Svix), sem dependência.
 *
 * Conteúdo assinado: `${svix-id}.${svix-timestamp}.${corpo bruto}`, HMAC-SHA256
 * com a chave decodificada de base64 (o segredo vem como `whsec_<base64>`).
 * O header `svix-signature` traz uma ou mais assinaturas `v1,<base64>`
 * separadas por espaço (várias durante rotação de segredo).
 * O corpo precisa ser o texto BRUTO, antes de qualquer parse.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const SVIX_TOLERANCE_SECONDS = 5 * 60;

export type SvixVerification = { ok: true } | { ok: false; reason: "cabecalhos" | "timestamp" | "assinatura" };

export function verifyResendWebhook(params: {
  rawBody: string;
  svixId: string | null;
  svixTimestamp: string | null;
  svixSignature: string | null;
  secret: string;
  nowMs?: number;
}): SvixVerification {
  const { rawBody, svixId, svixTimestamp, svixSignature, secret } = params;
  if (!svixId || !svixTimestamp || !svixSignature) return { ok: false, reason: "cabecalhos" };

  const ts = Number(svixTimestamp);
  if (!Number.isInteger(ts)) return { ok: false, reason: "timestamp" };
  const nowSec = Math.floor((params.nowMs ?? Date.now()) / 1000);
  if (Math.abs(nowSec - ts) > SVIX_TOLERANCE_SECONDS) return { ok: false, reason: "timestamp" };

  const key = Buffer.from(secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret, "base64");
  const expected = createHmac("sha256", key).update(`${svixId}.${svixTimestamp}.${rawBody}`).digest();

  for (const part of svixSignature.split(" ")) {
    const [version, sig] = part.split(",");
    if (version !== "v1" || !sig) continue;
    const given = Buffer.from(sig, "base64");
    if (given.length === expected.length && timingSafeEqual(given, expected)) return { ok: true };
  }
  return { ok: false, reason: "assinatura" };
}
