import { WebhookSignatureValidator, InvalidWebhookSignatureError } from "mercadopago";

export type SignatureCheck =
  | { ok: true; idVariant: "original" | "minusculo" }
  | { ok: false; reason: string; requestId?: string; idComMaiusculas: boolean };

const TOLERANCE_SECONDS = 300;

type Attempt = { ok: true } | { ok: false; error: InvalidWebhookSignatureError };

function attempt(
  opts: { xSignature: string | null; xRequestId: string | null; secret: string },
  dataId: string | null
): Attempt {
  try {
    WebhookSignatureValidator.validate({
      xSignature: opts.xSignature,
      xRequestId: opts.xRequestId,
      dataId,
      secret: opts.secret,
      toleranceSeconds: TOLERANCE_SECONDS,
    });
    return { ok: true };
  } catch (err) {
    if (err instanceof InvalidWebhookSignatureError) return { ok: false, error: err };
    throw err;
  }
}

/**
 * Valida a assinatura do webhook da Mercado Pago.
 *
 * O SDK monta o texto assinado com o `data.id` exatamente como recebido.
 * Se a Mercado Pago assinar com o id em minúsculas enquanto a URL traz o id
 * em maiúsculas (ids de order são alfanuméricos, ex.: ORD01M6...), a
 * assinatura legítima falharia sempre com `SignatureMismatch`. Por isso, e
 * somente nesse caso, tenta-se uma segunda vez com o id em minúsculas.
 *
 * Isso não enfraquece a verificação: as duas variantes continuam exigindo o
 * HMAC-SHA256 com o segredo, o `x-request-id` e o `ts` dentro da tolerância.
 * Quem não tem o segredo não forja nenhuma das duas. O resultado diz qual
 * variante valeu, para diagnosticar a configuração em produção.
 */
export function verifyMpWebhookSignature(opts: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
  secret: string;
}): SignatureCheck {
  const first = attempt(opts, opts.dataId);
  if (first.ok) return { ok: true, idVariant: "original" };

  const idComMaiusculas = opts.dataId !== null && opts.dataId !== opts.dataId.toLowerCase();

  let reason: string = first.error.reason;
  if (first.error.reason === "SignatureMismatch" && idComMaiusculas && opts.dataId !== null) {
    const second = attempt(opts, opts.dataId.toLowerCase());
    if (second.ok) return { ok: true, idVariant: "minusculo" };
    // Se a assinatura bateu com a variante minúscula mas falhou por outro motivo
    // (ex.: timestamp velho), esse é o diagnóstico útil, não o "não bateu".
    if (second.error.reason !== "SignatureMismatch") reason = second.error.reason;
  }

  return {
    ok: false,
    reason,
    requestId: first.error.requestId,
    idComMaiusculas,
  };
}
