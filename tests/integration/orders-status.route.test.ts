import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { NextRequest } from "next/server";
import type { PGlite } from "@electric-sql/pglite";
import type { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { startTestDb, stopTestDb, resetTestDb, TEST_SQL_GLOBAL_KEY } from "../helpers/test-db";

vi.mock("@/lib/db", () => ({
  get sql() {
    return (globalThis as Record<string, unknown>)[TEST_SQL_GLOBAL_KEY];
  },
}));

const PORT = 55603;
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
  await sql`
    insert into pedidos (
      client_token, external_reference, area_slug, trilha, payer_email, amount, status, mp_order_id,
      qr_code, qr_code_base64, ticket_url, expires_at
    )
    values (
      'owner-token', 'owner-token-a1', 'financeiro', 'crescer', 'owner@example.com', 29.90, 'pendente', 'ORD-1',
      'copia-e-cola', 'base64img', 'https://ticket.example.com', now() + interval '30 minutes'
    )
  `;
});

async function getStatus(clientToken: string) {
  const { GET } = await import("@/app/api/orders/[id]/status/route");
  const req = new NextRequest(`http://localhost/api/orders/${clientToken}/status`);
  const res = await GET(req, { params: Promise.resolve({ id: clientToken }) });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

describe("GET /api/orders/:id/status", () => {
  it("quem tem o client_token correto consulta o próprio status", async () => {
    const { status, json } = await getStatus("owner-token");
    expect(status).toBe(200);
    expect(json.status).toBe("pendente");
    expect(json.expiresAt).toBeTruthy();
  });

  it("um client_token de outro pedido (não o 'dono') recebe 404 — não existe como adivinhar o token de outra pessoa", async () => {
    const { status } = await getStatus("token-de-outro-pedido-qualquer");
    expect(status).toBe(404);
  });

  it("a resposta não vaza campos internos do pedido (payer_email, amount, mp_order_id, qr_code...)", async () => {
    const { json } = await getStatus("owner-token");
    expect(Object.keys(json).sort()).toEqual(["expiresAt", "status"].sort());
    expect(json.payer_email).toBeUndefined();
    expect(json.payerEmail).toBeUndefined();
    expect(json.mp_order_id).toBeUndefined();
    expect(json.mpOrderId).toBeUndefined();
    expect(json.qr_code).toBeUndefined();
    expect(json.qrCode).toBeUndefined();
    expect(json.amount).toBeUndefined();
    expect(json.ticket_url).toBeUndefined();
    expect(json.ticketUrl).toBeUndefined();
  });

  it("reflete o status atual do pedido (pago)", async () => {
    await sql`update pedidos set status = 'pago' where client_token = 'owner-token'`;
    const { status, json } = await getStatus("owner-token");
    expect(status).toBe(200);
    expect(json.status).toBe("pago");
  });
});
