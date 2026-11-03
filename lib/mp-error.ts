/**
 * Resumo seguro de um erro do SDK da Mercado Pago para log e diagnóstico.
 *
 * `String(err)` é inútil em produção: o nome da classe é minificado (aparece
 * como "o") e, sem `message`/`error` no corpo, cai em "MercadoPago API error",
 * escondendo o dado que importa: o código HTTP (401, 404, 5xx...). Aqui só
 * saem campos vindos da RESPOSTA da API; o SDK nunca guarda o header
 * Authorization no erro.
 */
export type MpErrorSummary = {
  status?: number;
  error?: string;
  message?: string;
  causes?: { code?: unknown; description?: unknown }[];
};

export function describeMpError(err: unknown): MpErrorSummary {
  if (err === null || typeof err !== "object") {
    return { message: String(err) };
  }
  const e = err as { status?: unknown; error?: unknown; message?: unknown; causes?: unknown };

  const summary: MpErrorSummary = {};
  if (typeof e.status === "number" && e.status > 0) summary.status = e.status;
  if (typeof e.error === "string" && e.error) summary.error = e.error;
  if (typeof e.message === "string" && e.message) summary.message = e.message;
  if (Array.isArray(e.causes) && e.causes.length > 0) {
    summary.causes = e.causes.slice(0, 3).map((c) => {
      const cause = (c ?? {}) as { code?: unknown; description?: unknown };
      return { code: cause.code, description: cause.description };
    });
  }
  return summary;
}
