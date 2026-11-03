/**
 * Ameaça 1 (modelo de ameaças): injeção de SQL/comando.
 *
 * Defesa estrutural já existente, confirmada por revisão de código antes
 * de escrever estes testes: toda consulta em lib/pedidos.ts usa o template
 * tagueado `sql\`...${valor}...\`` do postgres.js, que envia cada valor
 * interpolado como parâmetro ligado (bind parameter) — nunca concatenação
 * de string. `grep -rn "sql.unsafe"` em lib/ e app/ não encontra nenhuma
 * ocorrência fora dos scripts de migração do harness/testes. Isso significa
 * que a defesa não depende de "escapar" o payload corretamente — o
 * conteúdo da string, seja ele qual for, nunca é interpretado como SQL.
 *
 * Os testes abaixo provam esse comportamento com payloads clássicos
 * (aspas, UNION, boolean-based, time-based) nos pontos de entrada reais:
 * clientToken (rota de status, não validada como UUID), payerEmail e a
 * query `data.id` do webhook. sqlmap não foi usado (o ambiente não tem
 * Python/pip — ver SECURITY_REVIEW.md); estes payloads foram escolhidos a
 * mão para cobrir as mesmas classes de ataque que o sqlmap testaria.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { NextRequest } from "next/server";
import type { PGlite } from "@electric-sql/pglite";
import type { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { startTestDb, stopTestDb, resetTestDb, TEST_SQL_GLOBAL_KEY } from "../helpers/test-db";
import { buildSignatureHeader } from "../helpers/mp-signature";
import { _resetRateLimitState } from "@/lib/rate-limit";

const { orderCreateMock, orderGetMock } = vi.hoisted(() => ({
  orderCreateMock: vi.fn(),
  orderGetMock: vi.fn(),
}));

vi.mock("mercadopago", async (importOriginal) => {
  const actual = await importOriginal<typeof import("mercadopago")>();
  return {
    ...actual,
    MercadoPagoConfig: class {},
    Order: class {
      create(args: unknown) {
        return orderCreateMock(args);
      }
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

const PORT = 55604;
const WEBHOOK_SECRET = "test-webhook-secret";

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
  orderGetMock.mockReset();
  _resetRateLimitState();
  await sql`
    insert into pedidos (client_token, external_reference, area_slug, trilha, payer_email, amount, status, mp_order_id)
    values ('legit-token-1', 'legit-token-1-a1', 'financeiro', 'crescer', 'legit@example.com', 29.90, 'pendente', 'ORD-LEGIT')
  `;
});

const SQLI_PAYLOADS = [
  "' OR '1'='1",
  "'; DROP TABLE pedidos; --",
  "' UNION SELECT client_token, payer_email, amount, amount, amount, amount, amount, amount, amount, amount, amount, amount, amount, amount FROM pedidos --",
  "x' AND 1=1 --",
  "'; SELECT pg_sleep(5); --",
  "legit-token-1' OR status='pago",
  "../../etc/passwd",
  "<script>alert(1)</script>",
];

async function countAllPedidos() {
  const [{ count }] = await sql<{ count: string }[]>`select count(*)::int as count from pedidos`;
  return Number(count);
}

describe("injeção de SQL — GET /api/orders/:id/status (client_token não validado como UUID, só parametrizado)", () => {
  for (const payload of SQLI_PAYLOADS) {
    it(`payload ${JSON.stringify(payload)} não retorna dados de outro pedido nem corrompe o banco`, async () => {
      const countBefore = await countAllPedidos();

      const { GET } = await import("@/app/api/orders/[id]/status/route");
      const req = new NextRequest(`http://localhost/api/orders/${encodeURIComponent(payload)}/status`);
      const res = await GET(req, { params: Promise.resolve({ id: payload }) });
      const json = await res.json().catch(() => null);

      // Nunca 500 (erro de banco vazando), nunca dados do pedido legítimo.
      expect(res.status).toBe(404);
      expect(json?.error).toBeTruthy();
      expect(json?.status).toBeUndefined();

      expect(await countAllPedidos()).toBe(countBefore); // nada foi apagado/alterado
      const stillThere = await sql`select 1 from pedidos where client_token = 'legit-token-1'`;
      expect(stillThere).toHaveLength(1); // DROP TABLE não executou
    });
  }
});

describe("injeção de SQL — POST /api/pix/create", () => {
  function validBody(overrides: Record<string, unknown> = {}) {
    return {
      area: "financeiro",
      trilha: "crescer",
      payerEmail: "comprador@example.com",
      clientToken: "22222222-2222-4222-8222-222222222222",
      ...overrides,
    };
  }

  async function postPixCreate(body: unknown) {
    const { POST } = await import("@/app/api/pix/create/route");
    const req = new NextRequest("http://localhost/api/pix/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const res = await POST(req);
    return { status: res.status, json: await res.json().catch(() => null) };
  }

  it("clientToken com payload de injeção é rejeitado antes de tocar o banco (validação de formato UUID)", async () => {
    for (const payload of SQLI_PAYLOADS) {
      const { status } = await postPixCreate(validBody({ clientToken: payload }));
      expect(status).toBe(400);
    }
    expect(orderCreateMock).not.toHaveBeenCalled();
  });

  it("payerEmail com payload de injeção (quando sintaticamente um e-mail) não corrompe o banco", async () => {
    orderCreateMock.mockResolvedValue({
      id: "ORD-INJ",
      transactions: { payments: [{ status: "action_required", payment_method: { qr_code: "x", qr_code_base64: "eA==" } }] },
    });
    const emailPayload = "a'; DROP TABLE pedidos; --@example.com";
    const { status } = await postPixCreate(validBody({ payerEmail: emailPayload, clientToken: "33333333-3333-4333-8333-333333333333" }));

    // Ou o formato de e-mail já rejeita (400), ou segue e grava o valor
    // literal como string — nos dois casos a tabela segue intacta.
    expect([200, 400, 500, 502]).toContain(status);
    const stillThere = await sql`select 1 from pedidos where client_token = 'legit-token-1'`;
    expect(stillThere).toHaveLength(1);
  });
});

describe("injeção de SQL — webhook (query data.id e headers)", () => {
  async function postWebhook(dataId: string, requestId: string) {
    const { POST } = await import("@/app/api/webhooks/mercadopago/route");
    const sig = buildSignatureHeader({ dataId, requestId, secret: WEBHOOK_SECRET });
    const url = `http://localhost/api/webhooks/mercadopago?data.id=${encodeURIComponent(dataId)}`;
    const req = new NextRequest(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-signature": sig.xSignature,
        "x-request-id": requestId,
      },
      body: JSON.stringify({ action: "order.processed", type: "order", data: { id: dataId } }),
    });
    return POST(req);
  }

  for (const payload of SQLI_PAYLOADS) {
    it(`data.id=${JSON.stringify(payload)} (com assinatura válida para esse valor) não corrompe o banco`, async () => {
      orderGetMock.mockResolvedValue({
        id: payload,
        status: "processed",
        status_detail: "accredited",
        transactions: { payments: [{ status: "processed", status_detail: "accredited", amount: "29.90" }] },
      });

      const countBefore = await countAllPedidos();
      const res = await postWebhook(payload, "req-injection-test");

      expect(res.status).toBe(200); // nenhum pedido bate com esse mp_order_id — no-op seguro
      expect(await countAllPedidos()).toBe(countBefore);
      const stillThere = await sql`select 1 from pedidos where client_token = 'legit-token-1'`;
      expect(stillThere).toHaveLength(1);
    });
  }
});
