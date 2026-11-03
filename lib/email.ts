/**
 * Cliente mínimo da API de envio do Resend, por `fetch` (sem dependência nova).
 *
 * Só código de servidor. Nunca registra a chave, o corpo do e-mail nem o
 * destinatário completo. A classificação do erro decide o que o worker faz:
 *   transitorio   rede, timeout, 5xx, 409 concurrent_idempotent_requests -> tenta de novo
 *   permanente    validação (400/422), 409 invalid_idempotent_request   -> falhou, sem retry (bug nosso)
 *   configuracao  401/403 ou chave/remetente ausentes                    -> pausa a fila, alerta
 *   taxa          429 por taxa                                           -> respeita retry-after, sem consumir tentativa
 *   cota          429 daily/monthly_quota_exceeded                       -> pausa a fila, sem consumir tentativa
 */
import { env } from "@/lib/env";

if (typeof window !== "undefined") {
  throw new Error("lib/email.ts é exclusivo do servidor.");
}

const RESEND_URL = "https://api.resend.com/emails";
export const SEND_TIMEOUT_MS = 10_000;

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Estável por pedido (e por reenvio). O corpo precisa ser idêntico entre tentativas da mesma chave. */
  idempotencyKey: string;
};

export type SendResult =
  | { ok: true; id: string }
  | {
      ok: false;
      kind: "transitorio" | "permanente" | "configuracao" | "taxa" | "cota";
      /** Segundos pedidos pelo Resend (header retry-after), quando houver. */
      retryAfterSec?: number;
      /** Motivo curto e sem dado pessoal, seguro para log e coluna `email_ultimo_erro`. */
      detail: string;
    };

export type EmailSender = (message: EmailMessage) => Promise<SendResult>;

/** `f***@dominio.com` — para log. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1) return "***";
  return `${email[0]}***${email.slice(at)}`;
}

/** Rejeita CR/LF e controle em e-mail e assunto (injeção de cabeçalho). */
export function hasHeaderInjection(value: string): boolean {
  // eslint-disable-next-line no-control-regex
  return /[\r\n\u0000-\u001f\u007f]/.test(value);
}

function parseRetryAfter(res: Response): number | undefined {
  const raw = res.headers.get("retry-after");
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.min(Math.ceil(n), 3600) : undefined;
}

export const sendEmailViaResend: EmailSender = async (message) => {
  const apiKey = env.RESEND_API_KEY;
  const from = env.EMAIL_FROM;
  if (!apiKey) return { ok: false, kind: "configuracao", detail: "RESEND_API_KEY ausente" };
  if (!from) return { ok: false, kind: "configuracao", detail: "EMAIL_FROM ausente" };

  if (hasHeaderInjection(message.to) || hasHeaderInjection(message.subject) || hasHeaderInjection(from)) {
    return { ok: false, kind: "permanente", detail: "cabeçalho com caractere de controle" };
  }

  let res: Response;
  try {
    res = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": message.idempotencyKey,
      },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (err) {
    // Timeout e falha de rede são seguros de repetir com a MESMA chave.
    const name = err instanceof Error ? err.name : "erro";
    return { ok: false, kind: "transitorio", detail: `rede (${name})` };
  }

  let body: { id?: unknown; name?: unknown } | null = null;
  try {
    body = (await res.json()) as { id?: unknown; name?: unknown };
  } catch {
    body = null;
  }
  const errName = typeof body?.name === "string" ? body.name.slice(0, 60) : "";

  if (res.ok) {
    if (typeof body?.id === "string" && body.id.length > 0) return { ok: true, id: body.id };
    return { ok: false, kind: "transitorio", detail: "resposta sem id" };
  }

  const retryAfterSec = parseRetryAfter(res);

  if (res.status === 429) {
    if (errName === "daily_quota_exceeded" || errName === "monthly_quota_exceeded") {
      return { ok: false, kind: "cota", retryAfterSec, detail: errName };
    }
    return { ok: false, kind: "taxa", retryAfterSec, detail: errName || "rate_limit" };
  }
  if (res.status === 401 || res.status === 403) {
    return { ok: false, kind: "configuracao", detail: `HTTP ${res.status} ${errName}`.trim() };
  }
  if (res.status === 409) {
    if (errName === "concurrent_idempotent_requests") {
      return { ok: false, kind: "transitorio", retryAfterSec, detail: errName };
    }
    // invalid_idempotent_request: mesma chave com corpo diferente — bug nosso.
    return { ok: false, kind: "permanente", detail: `HTTP 409 ${errName}`.trim() };
  }
  if (res.status >= 500 || res.status === 408) {
    return { ok: false, kind: "transitorio", retryAfterSec, detail: `HTTP ${res.status}` };
  }
  // Demais 4xx (400, 422...): validação. Repetir não ajuda.
  return { ok: false, kind: "permanente", detail: `HTTP ${res.status} ${errName}`.trim() };
};
