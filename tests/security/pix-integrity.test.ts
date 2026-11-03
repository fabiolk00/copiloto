/**
 * Ameaça 2: interceptação/adulteração do "receptor" do Pix — o cliente
 * tentando controlar valor, recebedor, chave Pix ou external_reference, ou
 * fazer um Pix pago para o pedido X liberar o pedido Y.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { NextRequest } from "next/server";
import type { PGlite } from "@electric-sql/pglite";
import type { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { startTestDb, stopTestDb, resetTestDb, TEST_SQL_GLOBAL_KEY } from "../helpers/test-db";
import { buildSignatureHeader } from "../helpers/mp-signature";
import { buildPixOrderCreateResponse, buildPixOrderGetResponsePaid } from "../helpers/mp-fixtures";
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

const PORT = 55605;
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
});

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

async function postWebhook(dataId: string, overrides: Partial<{ requestId: string }> = {}) {
  const { POST } = await import("@/app/api/webhooks/mercadopago/route");
  const requestId = overrides.requestId ?? "req-1";
  const sig = buildSignatureHeader({ dataId, requestId, secret: WEBHOOK_SECRET });
  const req = new NextRequest(`http://localhost/api/webhooks/mercadopago?data.id=${encodeURIComponent(dataId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-signature": sig.xSignature, "x-request-id": requestId },
    body: JSON.stringify({ action: "order.processed", type: "order", data: { id: dataId } }),
  });
  return POST(req);
}

describe("mass assignment: o cliente não controla preço, recebedor nem referência da order", () => {
  it("campos extras no corpo (amount, total_amount, payer, external_reference, mp_order_id, status) são ignorados", async () => {
    orderCreateMock.mockResolvedValueOnce(buildPixOrderCreateResponse({ id: "ORD-MASS-1" }));

    const clientToken = "44444444-4444-4444-8444-444444444444";
    await postPixCreate({
      area: "financeiro",
      trilha: "crescer",
      payerEmail: "comprador@example.com",
      clientToken,
      // tudo abaixo é lixo que um atacante tentaria injetar no corpo:
      amount: "0.01",
      total_amount: "0.01",
      price: 0,
      payer: { email: "atacante@evil.com" },
      external_reference: "pedido-de-outra-pessoa",
      mp_order_id: "ORD-FORJADO",
      status: "pago",
      pix_key: "chave-pix-do-atacante@evil.com",
      recipient: "atacante@evil.com",
    });

    // O corpo realmente enviado à Mercado Pago só pode conter o que o servidor monta.
    const sentBody = orderCreateMock.mock.calls[0][0].body;
    expect(sentBody.total_amount).toBe("29.90");
    expect(sentBody.payer).toEqual({ email: "comprador@example.com" });
    expect(sentBody.external_reference).toBe(`${clientToken}-a1`);
    expect(sentBody).not.toHaveProperty("pix_key");
    expect(sentBody).not.toHaveProperty("recipient");

    const [row] = await sql`select * from pedidos where client_token = ${clientToken}`;
    expect(row.amount).toBe("29.90");
    expect(row.status).toBe("pendente"); // "status: pago" no corpo não teve efeito nenhum
    expect(row.mp_order_id).toBe("ORD-MASS-1"); // não "ORD-FORJADO"
  });

  it("JSON com campo duplicado usa a última ocorrência (comportamento padrão do JSON.parse) e ainda assim nunca o preço", async () => {
    orderCreateMock.mockResolvedValueOnce(buildPixOrderCreateResponse({ id: "ORD-MASS-2" }));
    const clientToken = "55555555-5555-4555-8555-555555555555";

    // JSON.parse nativo já colapsa chaves duplicadas na última — simulamos
    // isso diretamente (não há como representar chave duplicada em um objeto JS).
    const rawBody = `{"area":"financeiro","payerEmail":"primeiro@example.com","payerEmail":"comprador@example.com","clientToken":"${clientToken}"}`;
    const { POST } = await import("@/app/api/pix/create/route");
    const req = new NextRequest("http://localhost/api/pix/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: rawBody,
    });
    await POST(req);

    const sentBody = orderCreateMock.mock.calls[0][0].body;
    expect(sentBody.total_amount).toBe("29.90");
    expect(sentBody.payer.email).toBe("comprador@example.com");
  });
});

describe("um Pix pago para a order X não libera o pedido Y", () => {
  it("webhook de pagamento com mp_order_id de X não altera o pedido Y, mesmo que Y esteja pendente", async () => {
    await sql`
      insert into pedidos (client_token, external_reference, area_slug, trilha, payer_email, amount, status, mp_order_id)
      values
        ('pedido-x', 'pedido-x-a1', 'financeiro', 'crescer', 'x@example.com', 29.90, 'pendente', 'ORD-X'),
        ('pedido-y', 'pedido-y-a1', 'financeiro', 'crescer', 'y@example.com', 29.90, 'pendente', 'ORD-Y')
    `;
    orderGetMock.mockResolvedValueOnce(buildPixOrderGetResponsePaid());

    await postWebhook("ORD-X");

    const [x] = await sql`select status from pedidos where client_token = 'pedido-x'`;
    const [y] = await sql`select status from pedidos where client_token = 'pedido-y'`;
    expect(x.status).toBe("pago");
    expect(y.status).toBe("pendente"); // intocado
  });

  it("trocar o id da order no fluxo de criação (replay com external_reference de outro pedido) não reaproveita o Pix de outro cliente", async () => {
    orderCreateMock.mockResolvedValueOnce(buildPixOrderCreateResponse({ id: "ORD-VICTIM" }));
    await postPixCreate({
      area: "financeiro",
      payerEmail: "vitima@example.com",
      clientToken: "66666666-6666-4666-8666-666666666666",
    });

    orderCreateMock.mockResolvedValueOnce(buildPixOrderCreateResponse({ id: "ORD-ATTACKER" }));
    const { json: attackerJson } = await postPixCreate({
      area: "financeiro",
      payerEmail: "atacante@example.com",
      clientToken: "77777777-7777-4777-8777-777777777777",
    });

    // O atacante só recebe o Pix do PRÓPRIO clientToken — a order da vítima
    // nunca é referenciada nem retornada para outro clientToken.
    const [victim] = await sql`select mp_order_id from pedidos where client_token = '66666666-6666-4666-8666-666666666666'`;
    expect(attackerJson.pedidoId).toBe("77777777-7777-4777-8777-777777777777");
    expect(victim.mp_order_id).toBe("ORD-VICTIM");
    expect(victim.mp_order_id).not.toBe("ORD-ATTACKER");
  });
});

describe("pagamento a menor/diferente não libera o pedido (reforça a cobertura já existente em tests/integration/webhook.route.test.ts)", () => {
  it("valor da order menor que o do pedido não marca como pago", async () => {
    await sql`
      insert into pedidos (client_token, external_reference, area_slug, trilha, payer_email, amount, status, mp_order_id)
      values ('pedido-z', 'pedido-z-a1', 'financeiro', 'crescer', 'z@example.com', 29.90, 'pendente', 'ORD-Z')
    `;
    orderGetMock.mockResolvedValueOnce(buildPixOrderGetResponsePaid({ amount: "0.01" }));

    await postWebhook("ORD-Z");

    const [row] = await sql`select status from pedidos where client_token = 'pedido-z'`;
    expect(row.status).toBe("pendente");
  });
});

describe("o webhook nunca confia no corpo da notificação para o estado do pagamento", () => {
  it("corpo adulterado (status/valor forjados) com assinatura válida ainda reflete o estado real do GET /v1/orders/{id}", async () => {
    await sql`
      insert into pedidos (client_token, external_reference, area_slug, trilha, payer_email, amount, status, mp_order_id)
      values ('pedido-w', 'pedido-w-a1', 'financeiro', 'crescer', 'w@example.com', 29.90, 'pendente', 'ORD-W')
    `;
    // A Mercado Pago real ainda diz "pendente" — só o CORPO da notificação (que a
    // assinatura NÃO cobre, ver tests/helpers/mp-signature.ts) finge "pago".
    orderGetMock.mockResolvedValueOnce({
      id: "ORD-W",
      status: "action_required",
      status_detail: "waiting_transfer",
      transactions: { payments: [{ status: "action_required", status_detail: "waiting_transfer", amount: "29.90" }] },
    });

    const { POST } = await import("@/app/api/webhooks/mercadopago/route");
    const requestId = "req-tampered";
    const sig = buildSignatureHeader({ dataId: "ORD-W", requestId, secret: WEBHOOK_SECRET });
    const forgedBody = JSON.stringify({
      action: "order.processed",
      type: "order",
      data: { id: "ORD-W", status: "processed", status_detail: "accredited", total_amount: "29.90" },
    });
    const req = new NextRequest(`http://localhost/api/webhooks/mercadopago?data.id=ORD-W`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-signature": sig.xSignature, "x-request-id": requestId },
      body: forgedBody,
    });
    await POST(req);

    const [row] = await sql`select status from pedidos where client_token = 'pedido-w'`;
    expect(row.status).toBe("pendente"); // o corpo forjado diz "processed" mas o GET real venceu
    expect(orderGetMock).toHaveBeenCalledTimes(1); // a Orders API foi mesmo reconsultada
  });
});
