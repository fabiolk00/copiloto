import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { NextRequest } from "next/server";
import type { PGlite } from "@electric-sql/pglite";
import type { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { startTestDb, stopTestDb, resetTestDb, TEST_SQL_GLOBAL_KEY } from "../helpers/test-db";
import { buildSignatureHeader } from "../helpers/mp-signature";
import { _resetRateLimitState } from "@/lib/rate-limit";
import {
  buildPixOrderGetResponseCancelled,
  buildPixOrderGetResponsePaid,
  buildPixOrderGetResponsePending,
} from "../helpers/mp-fixtures";

const { orderGetMock } = vi.hoisted(() => ({ orderGetMock: vi.fn() }));

vi.mock("mercadopago", async (importOriginal) => {
  const actual = await importOriginal<typeof import("mercadopago")>();
  return {
    ...actual,
    MercadoPagoConfig: class {},
    Order: class {
      get(args: unknown) {
        return orderGetMock(args);
      }
    },
  };
});

vi.mock("@/lib/db", () => ({
  get sql() {
    return (globalThis as Record<string, unknown>)[TEST_SQL_GLOBAL_KEY];
  },
}));

const PORT = 55602;
const WEBHOOK_SECRET = "test-webhook-secret"; // precisa casar com tests/setup/env.ts (MP_WEBHOOK_SECRET)
const MP_ORDER_ID = "ORD-0001";

let sql: postgres.Sql;
let db: PGlite;
let server: PGLiteSocketServer;

beforeAll(async () => {
  ({ sql, db, server } = await startTestDb(PORT));
});

afterAll(async () => {
  await stopTestDb({ sql, db, server });
});

beforeEach(async () => {
  await resetTestDb(sql);
  orderGetMock.mockReset();
  _resetRateLimitState();
  await sql`
    insert into pedidos (client_token, external_reference, area_slug, trilha, payer_email, amount, status, mp_order_id)
    values ('client-tok-1', 'client-tok-1-a1', 'financeiro', 'crescer', 'comprador@example.com', 29.90, 'pendente', ${MP_ORDER_ID})
  `;
});

afterEach(() => {
  vi.clearAllMocks();
});

async function pedidoRow() {
  const [row] = await sql`select * from pedidos where mp_order_id = ${MP_ORDER_ID}`;
  return row;
}

async function postWebhook(params: {
  dataId?: string | null;
  action?: string;
  type?: string;
  signatureOverride?: string;
  requestId?: string;
  skipSignature?: boolean;
  rawBody?: string;
}) {
  const { POST } = await import("@/app/api/webhooks/mercadopago/route");
  const dataId = params.dataId === undefined ? MP_ORDER_ID : params.dataId;
  const requestId = params.requestId ?? "req-1";
  const url =
    dataId === null
      ? "http://localhost/api/webhooks/mercadopago"
      : `http://localhost/api/webhooks/mercadopago?data.id=${encodeURIComponent(dataId)}`;

  const headers: Record<string, string> = {};
  if (!params.skipSignature) {
    const sig =
      params.signatureOverride ??
      buildSignatureHeader({ dataId: dataId ?? "", requestId, secret: WEBHOOK_SECRET }).xSignature;
    headers["x-signature"] = sig;
    headers["x-request-id"] = requestId;
  }

  const body =
    params.rawBody ??
    JSON.stringify({
      action: params.action ?? "order.processed",
      type: params.type ?? "order",
      data: { id: dataId },
      date_created: new Date().toISOString(),
      live_mode: true,
      user_id: "123",
    });

  const req = new NextRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body,
  });
  const res = await POST(req);
  return { status: res.status };
}

describe("POST /api/webhooks/mercadopago", () => {
  it("assinatura válida + order processada e valor correto marca o pedido como pago", async () => {
    orderGetMock.mockResolvedValueOnce(buildPixOrderGetResponsePaid());

    const { status } = await postWebhook({ action: "order.processed" });

    expect(status).toBe(200);
    const row = await pedidoRow();
    expect(row.status).toBe("pago");
  });

  it("assinatura ausente retorna 401 e não altera o banco", async () => {
    const { status } = await postWebhook({ skipSignature: true });
    expect(status).toBe(401);
    expect(orderGetMock).not.toHaveBeenCalled();
    const row = await pedidoRow();
    expect(row.status).toBe("pendente");
  });

  it("assinatura inválida (secret errado) retorna 401 e não altera o banco", async () => {
    const badSig = buildSignatureHeader({ dataId: MP_ORDER_ID, requestId: "req-1", secret: "secret-errado" }).xSignature;
    const { status } = await postWebhook({ signatureOverride: badSig });
    expect(status).toBe(401);
    expect(orderGetMock).not.toHaveBeenCalled();
  });

  it("timestamp antigo (fora da tolerância de 300s) retorna 401", async () => {
    const staleTs = Math.floor(Date.now() / 1000) - 3600; // 1h atrás
    const staleSig = buildSignatureHeader({
      dataId: MP_ORDER_ID,
      requestId: "req-1",
      secret: WEBHOOK_SECRET,
      ts: staleTs,
    }).xSignature;
    const { status } = await postWebhook({ signatureOverride: staleSig });
    expect(status).toBe(401);
    expect(orderGetMock).not.toHaveBeenCalled();
  });

  it("o mesmo evento (mesma action) entregue 3 vezes só produz um efeito — a order só é consultada uma vez", async () => {
    orderGetMock.mockResolvedValueOnce(buildPixOrderGetResponsePaid());
    const requestId = "req-redelivery";
    const sig = buildSignatureHeader({ dataId: MP_ORDER_ID, requestId, secret: WEBHOOK_SECRET });

    for (let i = 0; i < 3; i++) {
      const { status } = await postWebhook({
        action: "order.processed",
        requestId,
        signatureOverride: sig.xSignature,
      });
      expect(status).toBe(200);
    }

    expect(orderGetMock).toHaveBeenCalledTimes(1);
    const row = await pedidoRow();
    expect(row.status).toBe("pago");
  });

  it("evento 'order.cancelled' chegando depois de 'order.processed' (pago) não reverte o status sem regra explícita", async () => {
    orderGetMock.mockResolvedValueOnce(buildPixOrderGetResponsePaid());
    const paid = await postWebhook({ action: "order.processed", requestId: "req-a" });
    expect(paid.status).toBe(200);
    expect((await pedidoRow()).status).toBe("pago");

    orderGetMock.mockResolvedValueOnce(buildPixOrderGetResponseCancelled());
    const cancelled = await postWebhook({ action: "order.cancelled", requestId: "req-b" });

    expect(cancelled.status).toBe(200);
    expect(orderGetMock).toHaveBeenCalledTimes(2);
    // markPedidoStatus só transiciona a partir de 'pendente' — o pedido já pago fica pago.
    expect((await pedidoRow()).status).toBe("pago");
  });

  it("valor da order diferente do valor do pedido não marca como pago", async () => {
    orderGetMock.mockResolvedValueOnce(buildPixOrderGetResponsePaid({ amount: "0.01" }));

    const { status } = await postWebhook({ action: "order.processed" });

    expect(status).toBe(200);
    const row = await pedidoRow();
    expect(row.status).toBe("pendente");
  });

  it("data.id sem pedido correspondente no banco responde 200 sem marcar nada como pago", async () => {
    orderGetMock.mockResolvedValueOnce(buildPixOrderGetResponsePaid());

    const { status } = await postWebhook({ dataId: "ORD-SEM-PEDIDO", action: "order.processed" });

    expect(status).toBe(200);
    const row = await pedidoRow();
    expect(row.status).toBe("pendente");
  });

  it("GET /v1/orders/{id} falhando responde 200 e agenda reprocessamento, sem marcar como pago", async () => {
    orderGetMock.mockRejectedValueOnce(new Error("Mercado Pago está fora do ar"));

    const { status } = await postWebhook({ action: "order.processed" });

    expect(status).toBe(200);
    expect((await pedidoRow()).status).toBe("pendente");

    const [reprocess] = await sql`select * from pedido_webhook_reprocessamentos where data_id = ${MP_ORDER_ID}`;
    expect(reprocess).toBeTruthy();
    expect(reprocess.reason).toContain("fora do ar");
  });

  it("uma nova entrega (action diferente) depois de uma falha de GET ainda é processada — não fica travada pelo dedup", async () => {
    orderGetMock.mockRejectedValueOnce(new Error("timeout"));
    const failed = await postWebhook({ action: "order.processed", requestId: "req-fail" });
    expect(failed.status).toBe(200);
    expect((await pedidoRow()).status).toBe("pendente");

    orderGetMock.mockResolvedValueOnce(buildPixOrderGetResponsePaid());
    const retried = await postWebhook({ action: "order.processed", requestId: "req-retry-2" });
    expect(retried.status).toBe(200);
  });

  it("corpo malformado (JSON inválido) é rejeitado com 400, sem exceção não tratada", async () => {
    const { status } = await postWebhook({ rawBody: "{ isso não é json ]]]" });
    expect(status).toBe(400);
    expect(orderGetMock).not.toHaveBeenCalled();
  });

  it("corpo sem 'type' é rejeitado com 400", async () => {
    const { status } = await postWebhook({ rawBody: JSON.stringify({ action: "order.processed", data: { id: MP_ORDER_ID } }) });
    expect(status).toBe(400);
  });

  it("payload muito grande é rejeitado com 413, sem exceção não tratada e sem tocar o banco", async () => {
    const hugePayload = JSON.stringify({
      action: "order.processed",
      type: "order",
      data: { id: MP_ORDER_ID },
      padding: "x".repeat(5 * 1024 * 1024),
    });

    const { status } = await postWebhook({ action: "order.processed", rawBody: hugePayload });

    expect(status).toBe(413);
    expect(orderGetMock).not.toHaveBeenCalled();
    expect((await pedidoRow()).status).toBe("pendente");
  });

  it("tópico desconhecido (nem 'order' nem 'orders') responde 200 sem consultar a Mercado Pago", async () => {
    const { status } = await postWebhook({ type: "payment", action: "payment.created" });
    expect(status).toBe(200);
    expect(orderGetMock).not.toHaveBeenCalled();
  });

  it("order pendente (action_required) não altera o status do pedido", async () => {
    orderGetMock.mockResolvedValueOnce(buildPixOrderGetResponsePending());
    const { status } = await postWebhook({ action: "order.created" });
    expect(status).toBe(200);
    expect((await pedidoRow()).status).toBe("pendente");
  });
});
