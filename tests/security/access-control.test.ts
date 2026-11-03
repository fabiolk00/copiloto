/**
 * Ameaça 4: controle de acesso (IDOR) e endpoints de debug/admin.
 *
 * Este app não tem contas de usuário (ver app/api/orders/[id]/status/route.ts) —
 * o controle de acesso é por capacidade: quem tem o `client_token` (um
 * UUID v4, 122 bits de entropia, gerado no navegador) age como dono do
 * pedido. "Usuário B" abaixo é só outro client_token, nunca adivinhado a
 * partir do de A.
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

const PORT = 55607;
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

const USER_A_TOKEN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_B_TOKEN = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

async function seedPedidoA() {
  await sql`
    insert into pedidos (
      client_token, external_reference, area_slug, trilha, payer_email, amount, status, mp_order_id,
      qr_code, qr_code_base64, ticket_url, expires_at
    )
    values (
      ${USER_A_TOKEN}, ${USER_A_TOKEN + "-a1"}, 'financeiro', 'crescer', 'usuario.a@example.com', 29.90, 'pendente', 'ORD-A',
      'copia-e-cola-de-a', 'base64-de-a', 'https://ticket.example.com/a', now() + interval '30 minutes'
    )
  `;
}

async function getStatus(clientToken: string) {
  const { GET } = await import("@/app/api/orders/[id]/status/route");
  const req = new NextRequest(`http://localhost/api/orders/${clientToken}/status`);
  const res = await GET(req, { params: Promise.resolve({ id: clientToken }) });
  return { status: res.status, json: await res.json().catch(() => null) };
}

describe("IDOR — GET /api/orders/:id/status", () => {
  beforeEach(seedPedidoA);

  it("usuário B não consegue ler o status do pedido de A usando o próprio token (diferente)", async () => {
    const { status, json } = await getStatus(USER_B_TOKEN);
    expect(status).toBe(404);
    expect(json).not.toHaveProperty("qr_code");
  });

  it("a resposta para o dono (A) não vaza payer_email, amount, qr_code nem mp_order_id", async () => {
    const { json } = await getStatus(USER_A_TOKEN);
    expect(Object.keys(json).sort()).toEqual(["expiresAt", "status"]);
  });

  it("variações próximas do token de A (prefixo/sufixo trocado) não acertam o pedido", async () => {
    const near = USER_A_TOKEN.slice(0, -1) + "0";
    const { status } = await getStatus(near);
    expect(status).toBe(404);
  });
});

describe("IDOR — POST /api/pix/create", () => {
  beforeEach(seedPedidoA);

  it("usuário B não consegue pagar/alterar o pedido de A criando uma order com o token de A sem saber que ele já existe de forma diferente", async () => {
    // B não tem como "roubar" o pedido de A porque B nunca saberia o
    // client_token de A sem adivinhar um UUID v4 — mas se de alguma forma
    // tentasse usá-lo, o pior caso é continuar o MESMO pedido de A (não
    // criar um pedido de B disfarçado de A), o que é o comportamento correto
    // de "token = capacidade", não uma falha de isolamento entre contas.
    orderCreateMock.mockResolvedValueOnce(buildPixOrderCreateResponse({ id: "ORD-REPLAY" }));
    const { POST } = await import("@/app/api/pix/create/route");
    const req = new NextRequest("http://localhost/api/pix/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ area: "financeiro", payerEmail: "atacante@evil.com", clientToken: USER_A_TOKEN }),
    });
    await POST(req);

    const [row] = await sql`select payer_email, qr_code from pedidos where client_token = ${USER_A_TOKEN}`;
    // O e-mail do pedido de A não foi sobrescrito pelo atacante — é um replay do Pix já existente.
    expect(row.payer_email).toBe("usuario.a@example.com");
    expect(row.qr_code).toBe("copia-e-cola-de-a");
    expect(orderCreateMock).not.toHaveBeenCalled();
  });

  it("um token nunca usado antes (gerado por B) sempre cria um pedido novo e isolado do de A", async () => {
    orderCreateMock.mockResolvedValueOnce(buildPixOrderCreateResponse({ id: "ORD-B" }));
    const { POST } = await import("@/app/api/pix/create/route");
    const req = new NextRequest("http://localhost/api/pix/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ area: "financeiro", payerEmail: "usuario.b@example.com", clientToken: USER_B_TOKEN }),
    });
    await POST(req);

    const [a] = await sql`select mp_order_id from pedidos where client_token = ${USER_A_TOKEN}`;
    const [b] = await sql`select mp_order_id, payer_email from pedidos where client_token = ${USER_B_TOKEN}`;
    expect(a.mp_order_id).toBe("ORD-A");
    expect(b.mp_order_id).toBe("ORD-B");
    expect(b.payer_email).toBe("usuario.b@example.com");
  });
});

describe("não existem endpoints de debug/admin expostos", () => {
  const candidatePaths = ["/api/debug", "/api/admin", "/api/internal", "/api/health", "/api/__debug", "/.env", "/api/pedidos"];

  it.each(candidatePaths)("GET %s não existe como rota da aplicação", async (path) => {
    // Confirma por inspeção do próprio código-fonte de rotas, não por uma
    // chamada HTTP real (o harness de rota aqui não sobe um servidor
    // completo) — garante que nenhuma dessas rotas foi definida em app/api.
    const fs = await import("node:fs");
    const definedRoutes = fs
      .readdirSync("app/api", { recursive: true })
      .filter((f) => typeof f === "string" && f.endsWith("route.ts"))
      .map((f) => "/api/" + (f as string).replace(/\\/g, "/").replace(/\/route\.ts$/, ""));

    expect(definedRoutes).not.toContain(path);
  });

  it("as únicas rotas de API existentes são exatamente as 3 esperadas (nenhuma rota de debug foi adicionada sem querer)", async () => {
    const fs = await import("node:fs");
    const definedRoutes = fs
      .readdirSync("app/api", { recursive: true })
      .filter((f) => typeof f === "string" && f.endsWith("route.ts"))
      .map((f) => (f as string).replace(/\\/g, "/"))
      .sort();

    expect(definedRoutes).toEqual(
      ["orders/[id]/status/route.ts", "pix/create/route.ts", "webhooks/mercadopago/route.ts"].sort()
    );
  });
});
