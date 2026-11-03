import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp, type RateLimitResult } from "@/lib/rate-limit";

/**
 * Lê e faz parse do corpo como JSON, limitando quantos bytes são
 * aceitos. `Content-Length` é checado primeiro (rejeição rápida, sem ler
 * nada), mas não é a única defesa — um cliente pode omitir ou mentir nesse
 * header (chunked transfer, por exemplo), então o corpo também é lido em
 * streaming com contagem própria, abortando assim que o limite é
 * excedido, antes de materializar o payload inteiro em memória.
 */
export async function readJsonWithLimit(
  req: Request,
  maxBytes: number
): Promise<{ ok: true; data: unknown } | { ok: false; status: 413 }> {
  const contentLength = req.headers.get("content-length");
  if (contentLength && Number(contentLength) > maxBytes) {
    return { ok: false, status: 413 };
  }

  if (!req.body) {
    return { ok: true, data: null };
  }

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      return { ok: false, status: 413 };
    }
    chunks.push(value);
  }

  const raw = Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf8");
  try {
    return { ok: true, data: raw.length > 0 ? JSON.parse(raw) : null };
  } catch {
    return { ok: true, data: null };
  }
}

export function tooLargeResponse() {
  return NextResponse.json({ error: "Corpo da requisição excede o tamanho máximo permitido." }, { status: 413 });
}

export function rateLimitedResponse(result: RateLimitResult) {
  return NextResponse.json(
    { error: "Muitas requisições. Tente novamente em instantes." },
    { status: 429, headers: { "Retry-After": String(Math.ceil((result.resetAt - Date.now()) / 1000)) } }
  );
}

/** Aplica um limite de taxa por IP a uma rota; devolve a resposta 429 pronta quando excedido, ou `null` quando pode seguir. */
export function enforceIpRateLimit(
  req: { headers: { get(name: string): string | null } },
  { keyPrefix, limit, windowMs }: { keyPrefix: string; limit: number; windowMs: number }
): NextResponse | null {
  const ip = getClientIp(req);
  const result = checkRateLimit(`${keyPrefix}:${ip}`, limit, windowMs);
  if (!result.allowed) return rateLimitedResponse(result);
  return null;
}
