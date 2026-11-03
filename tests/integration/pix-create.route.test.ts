import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { NextRequest } from "next/server";
import { MPRateLimitError, MPServerError } from "mercadopago";
import type { PGlite } from "@electric-sql/pglite";
import type { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { startTestDb, stopTestDb, resetTestDb, TEST_SQL_GLOBAL_KEY } from "../helpers/test-db";
import { buildPixOrderCreateResponse } from "../helpers/mp-fixtures";
import { _resetRateLimitState } from "@/lib/rate-limit";

const { orderCreateMock } = vi.hoisted(() => ({ orderCreateMock: vi.fn() }));

vi.mock("mercadopago", async (importOriginal) => {
  const actual = await importOriginal<typeof import("mercadopago")>();
  return {
    ...actual,
    MercadoPagoConfig: class {},
    Order: class {
      create(args: unknown) {
        return orderCreateMock(args);
      }
    },
  };
});

vi.mock("@/lib/db", () => ({
  get sql() {
    return (globalThis as Record<string, unknown>)[TEST_SQL_GLOBAL_KEY];
  },
}));

const PORT = 55601;
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
  orderCreateMock.mockReset();
  _resetRateLimitState();
});

afterEach(() => {
  vi.clearAllMocks();
});

async function postPixCreate(body: unknown) {
  const { POST } = await import("@/app/api/pix/create/route");
  const req = new NextRequest("http://localhost/api/pix/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const res = await POST(req);
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    area: "financeiro",
    trilha: "crescer",
    payerEmail: "comprador@example.com",
    clientToken: "11111111-1111-4111-8111-111111111111",
    ...overrides,
  };
}

describe("POST /api/pix/create", () => {
  it("pedido válido gera a order na Mercado Pago e persiste mp_order_id", async () => {
    orderCreateMock.mockResolvedValueOnce(buildPixOrderCreateResponse({ id: "ORD-123" }));

    const { status, json } = await postPixCreate(validBody());

    expect(status).toBe(200);
    expect(json.qrCode).toBeTruthy();
    expect(json.qrCodeBase64).toBeTruthy();
    expect(json.ticketUrl).toBeTruthy();

    const [row] = await sql`select * from pedidos where client_token = ${validBody().clientToken}`;
    expect(row.mp_order_id).toBe("ORD-123");
    expect(row.status).toBe("pendente");
    expect(row.attempt).toBe(1);
    expect(row.amount).toBe("29.90");
    expect(orderCreateMock).toHaveBeenCalledTimes(1);
  });

  it("calcula o total sempre a partir do preço do servidor, ignorando qualquer valor enviado pelo cliente", async () => {
    orderCreateMock.mockResolvedValueOnce(buildPixOrderCreateResponse({ id: "ORD-999" }));

    await postPixCreate(validBody({ amount: "0.01", total_amount: "0.01", price: 0 }));

    const sentBody = orderCreateMock.mock.calls[0][0].body;
    expect(sentBody.total_amount).toBe("29.90");
    expect(sentBody.transactions.payments[0].amount).toBe("29.90");

    const [row] = await sql`select amount from pedidos where client_token = ${validBody().clientToken}`;
    expect(row.amount).toBe("29.90");
  });

  it("área inválida retorna 400 e não chama a Mercado Pago", async () => {
    const { status, json } = await postPixCreate(validBody({ area: "nao-existe" }));

    expect(status).toBe(400);
    expect(json.error).toBeTruthy();
    expect(orderCreateMock).not.toHaveBeenCalled();
  });

  it("corpo inválido (clientToken não-UUID) retorna 400", async () => {
    const { status } = await postPixCreate(validBody({ clientToken: "not-a-uuid" }));
    expect(status).toBe(400);
    expect(orderCreateMock).not.toHaveBeenCalled();
  });

  it("replay do mesmo clientToken ainda pendente e não expirado devolve o Pix existente sem criar nova order", async () => {
    orderCreateMock.mockResolvedValueOnce(buildPixOrderCreateResponse({ id: "ORD-111" }));
    const first = await postPixCreate(validBody());
    expect(first.status).toBe(200);

    orderCreateMock.mockReset();
    const second = await postPixCreate(validBody());

    expect(second.status).toBe(200);
    expect(second.json.qrCode).toBe(first.json.qrCode);
    expect(orderCreateMock).not.toHaveBeenCalled();

    const rows = await sql`select * from pedidos where client_token = ${validBody().clientToken}`;
    expect(rows).toHaveLength(1);
    expect(rows[0].attempt).toBe(1);
  });

  it("pedido já pago retorna 409 e não chama a Mercado Pago de novo", async () => {
    orderCreateMock.mockResolvedValueOnce(buildPixOrderCreateResponse({ id: "ORD-222" }));
    await postPixCreate(validBody());
    await sql`update pedidos set status = 'pago' where client_token = ${validBody().clientToken}`;

    orderCreateMock.mockReset();
    const { status, json } = await postPixCreate(validBody());

    expect(status).toBe(409);
    expect(json.error).toBeTruthy();
    expect(orderCreateMock).not.toHaveBeenCalled();
  });

  it("pedido expirado gera uma nova tentativa com novo external_reference e attempt incrementado", async () => {
    orderCreateMock.mockResolvedValueOnce(buildPixOrderCreateResponse({ id: "ORD-333" }));
    await postPixCreate(validBody());
    await sql`update pedidos set expires_at = now() - interval '1 hour' where client_token = ${validBody().clientToken}`;

    orderCreateMock.mockReset();
    orderCreateMock.mockResolvedValueOnce(
      buildPixOrderCreateResponse({ id: "ORD-444", externalReference: `${validBody().clientToken}-a2` })
    );
    const { status } = await postPixCreate(validBody());

    expect(status).toBe(200);
    expect(orderCreateMock).toHaveBeenCalledTimes(1);
    const sentBody = orderCreateMock.mock.calls[0][0].body;
    expect(sentBody.external_reference).toBe(`${validBody().clientToken}-a2`);

    const [row] = await sql`select * from pedidos where client_token = ${validBody().clientToken}`;
    expect(row.attempt).toBe(2);
    expect(row.mp_order_id).toBe("ORD-444");
  });

  it("erro 429 da Mercado Pago é tratado como 500 e não deixa order/pedido duplicado", async () => {
    orderCreateMock.mockRejectedValueOnce(
      new MPRateLimitError({ status: 429, message: "Too many requests", error: "too_many_requests" }, 5)
    );

    const { status } = await postPixCreate(validBody());

    expect(status).toBe(500);
    const rows = await sql`select * from pedidos where client_token = ${validBody().clientToken}`;
    expect(rows).toHaveLength(0);
  });

  it("erro 5xx da Mercado Pago é tratado como 500 e, numa nova tentativa bem-sucedida, cria só uma order (attempt 1)", async () => {
    orderCreateMock.mockRejectedValueOnce(
      new MPServerError({ status: 500, message: "Internal error", error: "internal_error" })
    );
    const failed = await postPixCreate(validBody());
    expect(failed.status).toBe(500);

    orderCreateMock.mockReset();
    orderCreateMock.mockResolvedValueOnce(buildPixOrderCreateResponse({ id: "ORD-555" }));
    const retried = await postPixCreate(validBody());

    expect(retried.status).toBe(200);
    expect(orderCreateMock).toHaveBeenCalledTimes(1);

    const rows = await sql`select * from pedidos where client_token = ${validBody().clientToken}`;
    expect(rows).toHaveLength(1);
    expect(rows[0].attempt).toBe(1);
    expect(rows[0].mp_order_id).toBe("ORD-555");
  });

  it("chave de idempotência enviada à Mercado Pago é estável por pedido+tentativa", async () => {
    orderCreateMock.mockResolvedValueOnce(buildPixOrderCreateResponse({ id: "ORD-666" }));
    await postPixCreate(validBody());

    const requestOptions = orderCreateMock.mock.calls[0][0].requestOptions;
    expect(requestOptions.idempotencyKey).toBe(`pix-order:${validBody().clientToken}:1`);
  });
});
