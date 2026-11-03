/**
 * Ameaça 7: disponibilidade — limite de abuso em /api/pix/create e
 * confirmação de que a idempotência evita milhares de orders mesmo sob
 * carga concorrente para o mesmo pedido.
 *
 * Teste de carga "pesado" (sqlmap/ZAP-style) não roda aqui — ver
 * SECURITY_REVIEW.md. Isto é um teste de carga leve, determinístico, local.
 */
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

const PORT = 55608;
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

async function postPixCreate(body: unknown, ip?: string) {
  const { POST } = await import("@/app/api/pix/create/route");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (ip) headers["x-forwarded-for"] = ip;
  const req = new NextRequest("http://localhost/api/pix/create", { method: "POST", headers, body: JSON.stringify(body) });
  return POST(req);
}

describe("rate limit em /api/pix/create", () => {
  it("um IP tentando criar muitos pedidos novos é limitado (429) antes de 11 chamadas na janela", async () => {
    orderCreateMock.mockImplementation(async () => buildPixOrderCreateResponse({ id: `ORD-${Math.random()}` }));
    const ip = "198.51.100.77";

    const statuses: number[] = [];
    for (let i = 0; i < 15; i++) {
      const res = await postPixCreate(
        { area: "financeiro", payerEmail: `cliente${i}@example.com`, clientToken: crypto.randomUUID() },
        ip
      );
      statuses.push(res.status);
    }

    expect(statuses.filter((s) => s === 429).length).toBeGreaterThan(0);
    // O limite (10/min) corta antes de permitir todas as 15 — confirma que
    // não dá para abrir "milhares de orders" trocando de clientToken.
    expect(statuses.filter((s) => s === 200).length).toBeLessThanOrEqual(10);
  });

  it("não afeta outro IP tentando o fluxo legítimo", async () => {
    orderCreateMock.mockImplementation(async () => buildPixOrderCreateResponse({ id: `ORD-${Math.random()}` }));
    for (let i = 0; i < 10; i++) {
      await postPixCreate({ area: "financeiro", payerEmail: `flood${i}@example.com`, clientToken: crypto.randomUUID() }, "203.0.113.9");
    }
    const res = await postPixCreate(
      { area: "financeiro", payerEmail: "legitimo@example.com", clientToken: crypto.randomUUID() },
      "203.0.113.200"
    );
    expect(res.status).toBe(200);
  });
});

describe("idempotência sob concorrência: o mesmo pedido nunca gera duas orders", () => {
  it("10 requisições concorrentes com o MESMO clientToken resultam em exatamente 1 pedido persistido", async () => {
    orderCreateMock.mockResolvedValue(buildPixOrderCreateResponse({ id: "ORD-CONCURRENT" }));
    const clientToken = crypto.randomUUID();

    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        postPixCreate({ area: "financeiro", payerEmail: "concorrente@example.com", clientToken }, `192.0.2.${i}`)
      )
    );

    const rows = await sql`select id from pedidos where client_token = ${clientToken}`;
    expect(rows).toHaveLength(1);
  });
});
