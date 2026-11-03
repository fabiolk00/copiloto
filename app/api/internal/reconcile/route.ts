import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { MercadoPagoConfig, Order } from "mercadopago";
import { env } from "@/lib/env";
import { getPedidosParaReconciliar, markPedidosReconciliados } from "@/lib/pedidos";
import { applyMpOrder } from "@/lib/reconcile";
import { checkRateLimit } from "@/lib/rate-limit";

const client = new MercadoPagoConfig({ accessToken: env.MP_ACCESS_TOKEN });

// Lote pequeno: cabe no tempo de uma função serverless e no timeout do pg_net.
const BATCH_SIZE = 10;
// Proteção contra abuso se o segredo vazar. O pg_cron chama no máximo 1x/min.
const RATE_LIMIT = { limit: 30, windowMs: 60_000 };

function sha256(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

/** Comparação em tempo constante do Bearer recebido com o segredo configurado. */
function isAuthorized(req: NextRequest, secret: string): boolean {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  return timingSafeEqual(sha256(token), sha256(secret));
}

// Chamada só pelo pg_cron/pg_net do Supabase (ver migration pg_cron_reconciliacao).
// Consulta na Mercado Pago os Pix ainda pendentes e aplica a mesma regra do
// webhook. Não aceita ids no corpo: os candidatos vêm do banco (view
// pedidos_a_reconciliar). Corpo da resposta traz só contagens.
export async function POST(req: NextRequest) {
  // Sem segredo configurado a rota nem existe para quem chama.
  if (!env.RECONCILE_SECRET) {
    return new NextResponse(null, { status: 404 });
  }

  if (!isAuthorized(req, env.RECONCILE_SECRET)) {
    return new NextResponse(null, { status: 401 });
  }

  const limit = checkRateLimit("reconcile", RATE_LIMIT.limit, RATE_LIMIT.windowMs);
  if (!limit.allowed) {
    return new NextResponse(null, { status: 429 });
  }

  try {
    const pedidos = await getPedidosParaReconciliar(BATCH_SIZE);
    if (pedidos.length === 0) {
      return NextResponse.json({ checked: 0, updated: 0, errors: 0 }, { headers: { "Cache-Control": "no-store" } });
    }

    const order = new Order(client);
    const results = await Promise.allSettled(
      pedidos.map(async (p) => {
        const mpOrder = await order.get({ id: p.mp_order_id });
        return applyMpOrder(p.mp_order_id, mpOrder);
      })
    );

    // Marca todos como conferidos agora (inclusive os que falharam), para o
    // critério da view dar um respiro de 30 s antes de tentar de novo.
    await markPedidosReconciliados(pedidos.map((p) => p.id));

    let updated = 0;
    let errors = 0;
    for (const r of results) {
      if (r.status === "rejected") {
        errors += 1;
        console.warn("[reconcile] falha ao conferir order", { error: String(r.reason) });
      } else if (r.value === "atualizado") {
        updated += 1;
      }
    }

    return NextResponse.json(
      { checked: pedidos.length, updated, errors },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[reconcile] falha inesperada", err instanceof Error ? err.message : "erro desconhecido");
    return new NextResponse(null, { status: 500 });
  }
}
