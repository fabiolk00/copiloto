/**
 * Limitador de taxa em memória, janela fixa por chave (ex.: IP). Suficiente
 * para uma instância única; não compartilha estado entre processos/réplicas
 * — numa implantação com múltiplas instâncias, mova para um store
 * compartilhado (Redis, Upstash) sem mudar a assinatura de `checkRateLimit`.
 *
 * Varre e descarta janelas expiradas a cada chamada em vez de usar um timer
 * próprio, para não manter o processo vivo artificialmente em ambientes
 * serverless.
 */

type Window = { count: number; resetAt: number };

const buckets = new Map<string, Window>();

export type RateLimitResult = { allowed: boolean; remaining: number; resetAt: number };

export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    pruneExpired(now);
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count += 1;
  return { allowed: true, remaining: limit - existing.count, resetAt: existing.resetAt };
}

function pruneExpired(now: number) {
  // Amortizado: só varre 1 em cada ~20 chamadas para não custar O(n) sempre.
  if (Math.random() > 0.05) return;
  for (const [key, window] of buckets) {
    if (window.resetAt <= now) buckets.delete(key);
  }
}

/** Só para testes — evita que o estado de um teste vaze para o próximo. */
export function _resetRateLimitState() {
  buckets.clear();
}

/**
 * IP do cliente a partir dos headers de proxy padrão. Confiável apenas
 * atrás de um proxy/CDN que normaliza esses headers (Vercel, nginx) — sem
 * isso, um cliente poderia forjar `x-forwarded-for` para escapar do limite.
 * Mesma limitação de qualquer rate limit por IP sem proxy confiável.
 */
export function getClientIp(req: { headers: { get(name: string): string | null } }): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}
