import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { NextRequest } from "next/server";
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

const PORT = 55611;
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

const TOKEN = "22222222-2222-4222-8222-222222222222";

function body(overrides: Record<string, unknown> = {}) {
  return {
    area: "financeiro",
    trilha: "crescer",
    payerEmail: "comprador@example.com",
    clientToken: TOKEN,
    ...overrides,
  };
}

describe("escolha obrigatória de trilha no pedido", () => {
  it("sem o campo trilha: 400 e nenhuma order na Mercado Pago", async () => {
    const { trilha: _omit, ...semTrilha } = body();
    const { status } = await postPixCreate(semTrilha);
    expect(status).toBe(400);
    expect(orderCreateMock).not.toHaveBeenCalled();
    const rows = await sql`select * from pedidos where client_token = ${TOKEN}`;
    expect(rows.length).toBe(0);
  });

  it("trilha null: 400 e nenhuma order na Mercado Pago", async () => {
    const { status } = await postPixCreate(body({ trilha: null }));
    expect(status).toBe(400);
    expect(orderCreateMock).not.toHaveBeenCalled();
  });

  it("trilha fora do conjunto (crescer|mudar): 400", async () => {
    const { status } = await postPixCreate(body({ trilha: "outra" }));
    expect(status).toBe(400);
    expect(orderCreateMock).not.toHaveBeenCalled();
  });

  it("Pix pendente e válido com trilha diferente: 409, sem nova order, pedido inalterado", async () => {
    orderCreateMock.mockResolvedValueOnce(buildPixOrderCreateResponse({ id: "ORD-A" }));
    await postPixCreate(body({ trilha: "crescer" }));

    const { status, json } = await postPixCreate(body({ trilha: "mudar" }));
    expect(status).toBe(409);
    expect(json.error).toMatch(/outra escolha/);
    expect(orderCreateMock).toHaveBeenCalledTimes(1);

    const [row] = await sql`select trilha, mp_order_id, attempt from pedidos where client_token = ${TOKEN}`;
    expect(row.trilha).toBe("crescer");
    expect(row.mp_order_id).toBe("ORD-A");
    expect(row.attempt).toBe(1);
  });

  it("Pix pendente e válido com a mesma escolha: reaproveita o código sem nova order", async () => {
    orderCreateMock.mockResolvedValueOnce(buildPixOrderCreateResponse({ id: "ORD-B" }));
    await postPixCreate(body({ trilha: "mudar" }));

    const { status } = await postPixCreate(body({ trilha: "mudar" }));
    expect(status).toBe(200);
    expect(orderCreateMock).toHaveBeenCalledTimes(1);
  });

  it("Pix expirado e nova escolha: nova tentativa grava a trilha e a área novas", async () => {
    orderCreateMock.mockResolvedValueOnce(buildPixOrderCreateResponse({ id: "ORD-C" }));
    await postPixCreate(body({ area: "financeiro", trilha: "crescer" }));
    await sql`update pedidos set expires_at = now() - interval '1 hour' where client_token = ${TOKEN}`;

    orderCreateMock.mockReset();
    orderCreateMock.mockResolvedValueOnce(
      buildPixOrderCreateResponse({ id: "ORD-D", externalReference: `${TOKEN}-a2` })
    );
    const { status } = await postPixCreate(body({ area: "comercial", trilha: "mudar" }));
    expect(status).toBe(200);

    const [row] = await sql`select area_slug, trilha, attempt, mp_order_id from pedidos where client_token = ${TOKEN}`;
    expect(row.area_slug).toBe("comercial");
    expect(row.trilha).toBe("mudar");
    expect(row.attempt).toBe(2);
    expect(row.mp_order_id).toBe("ORD-D");
  });
});
