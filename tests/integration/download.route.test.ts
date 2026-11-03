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

// Só a chamada de rede ao Storage é substituída. O mapeamento, a checagem de
// status e a rota reais continuam em execução. A chamada real é coberta em
// tests/live/storage.live.test.ts.
const signMock = vi.fn(async (path: string) => `https://storage.example.test/signed/${path}?token=fake`);
vi.mock("@/lib/storage", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/storage")>();
  return { ...real, createSignedPdfUrl: (path: string) => signMock(path) };
});

const PORT = 55610;
let sql: postgres.Sql;
let db: PGlite;
let server: PGLiteSocketServer;

beforeAll(async () => {
  ({ sql, db, server } = await startTestDb(PORT));
});

afterAll(async () => {
  await stopTestDb({ sql, db, server });
});

async function inserirPedido(token: string, area: string, trilha: string | null, status: string) {
  await sql`
    insert into pedidos (
      client_token, external_reference, area_slug, trilha, payer_email, amount, status, mp_order_id,
      qr_code, qr_code_base64, ticket_url, expires_at
    )
    values (
      ${token}, ${token + "-ref"}, ${area}, ${trilha}, 'pagador@example.com', 29.90, ${status}, ${token + "-mp"},
      'copia-e-cola', 'base64img', 'https://ticket.example.com', now() + interval '30 minutes'
    )
  `;
}

beforeEach(async () => {
  await resetTestDb(sql);
  signMock.mockClear();
});

async function baixar(clientToken: string) {
  const { GET } = await import("@/app/api/orders/[id]/download/route");
  const req = new NextRequest(`http://localhost/api/orders/${clientToken}/download`);
  const res = await GET(req, { params: Promise.resolve({ id: clientToken }) });
  const json = await res.json().catch(() => null);
  return { status: res.status, json, headers: res.headers };
}

describe("GET /api/orders/:id/download", () => {
  it("pedido pago: devolve só a URL assinada e o prazo, sem cache", async () => {
    await inserirPedido("tok-pago", "financeiro", "crescer", "pago");
    const { status, json, headers } = await baixar("tok-pago");
    expect(status).toBe(200);
    expect(json.url).toBe("https://storage.example.test/signed/Guia-Carreira-Financeiro-Crescer-na-Empresa.pdf?token=fake");
    expect(json.expiresIn).toBe(300);
    expect(Object.keys(json).sort()).toEqual(["expiresIn", "url"]);
    expect(headers.get("cache-control")).toBe("no-store");
    expect(signMock).toHaveBeenCalledWith("Guia-Carreira-Financeiro-Crescer-na-Empresa.pdf");
  });

  it("área analise-de-dados com trilha mudar usa o arquivo correspondente", async () => {
    await inserirPedido("tok-dados", "analise-de-dados", "mudar", "pago");
    const { status } = await baixar("tok-dados");
    expect(status).toBe(200);
    expect(signMock).toHaveBeenCalledWith("Guia-Carreira-Analise-de-Dados-Mudar-de-Empresa.pdf");
  });

  it("pedido pendente: 402 e nenhuma URL é assinada", async () => {
    await inserirPedido("tok-pendente", "comercial", "crescer", "pendente");
    const { status, json } = await baixar("tok-pendente");
    expect(status).toBe(402);
    expect(json.url).toBeUndefined();
    expect(signMock).not.toHaveBeenCalled();
  });

  it.each(["cancelado", "expirado", "falhou"])("pedido %s nunca recebe entrega", async (st) => {
    await inserirPedido(`tok-${st}`, "comercial", "mudar", st);
    const { status } = await baixar(`tok-${st}`);
    expect(status).toBe(402);
    expect(signMock).not.toHaveBeenCalled();
  });

  it("pedido pago sem trilha: recusado com 409, sem assinar nada", async () => {
    await inserirPedido("tok-sem-trilha", "financeiro", null, "pago");
    const { status, json } = await baixar("tok-sem-trilha");
    expect(status).toBe(409);
    expect(json.url).toBeUndefined();
    expect(signMock).not.toHaveBeenCalled();
  });

  it("client_token inexistente: 404", async () => {
    const { status } = await baixar("nao-existe");
    expect(status).toBe(404);
    expect(signMock).not.toHaveBeenCalled();
  });

  it("falha no Storage: 503 genérico, sem URL nem detalhe interno", async () => {
    await inserirPedido("tok-falha", "financeiro", "mudar", "pago");
    signMock.mockRejectedValueOnce(new Error("Falha ao assinar o PDF (HTTP 500)."));
    const { status, json } = await baixar("tok-falha");
    expect(status).toBe(503);
    expect(JSON.stringify(json)).not.toMatch(/https?:\/\//);
    expect(JSON.stringify(json)).not.toContain("HTTP 500");
  });

  it("a resposta de erro não vaza dados do pagador nem do Pix", async () => {
    await inserirPedido("tok-privacidade", "comercial", "crescer", "pendente");
    const { json } = await baixar("tok-privacidade");
    const texto = JSON.stringify(json);
    expect(texto).not.toContain("pagador@example.com");
    expect(texto).not.toContain("copia-e-cola");
    expect(texto).not.toContain("ticket.example.com");
  });
});
