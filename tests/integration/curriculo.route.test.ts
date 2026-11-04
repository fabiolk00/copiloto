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

// Só a chamada de rede ao Storage é substituída; mapeamento, checagem de
// status e rota reais continuam em execução (a chamada real fica em tests/live).
const signMock = vi.fn(async (path: string) => `https://storage.example.test/signed/${path}?token=fake`);
vi.mock("@/lib/storage", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/storage")>();
  return { ...real, createSignedPdfUrl: (path: string) => signMock(path) };
});

const PORT = 55617;
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
  signMock.mockClear();
});

async function inserir(token: string, area: string, trilha: string | null, status: string) {
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

async function pedir(token: string) {
  const { GET } = await import("@/app/api/orders/[id]/curriculo/route");
  const res = await GET(new NextRequest(`http://localhost/api/orders/${token}/curriculo`), {
    params: Promise.resolve({ id: token }),
  });
  return res;
}

describe("GET /api/orders/:id/curriculo", () => {
  it.each([
    ["financeiro", "Curriculo-ATS-Financeiro-Mudar-de-Empresa.docx"],
    ["analise-de-dados", "Curriculo-ATS-Analise-de-Dados-Mudar-de-Empresa.docx"],
    ["comercial", "Curriculo-ATS-Comercial-Mudar-de-Empresa.docx"],
    ["administrativo", "Curriculo-ATS-Administrativo-Mudar-de-Empresa.docx"],
  ])("pedido pago de %s: redireciona para o currículo da área, qualquer que seja a trilha", async (area, arquivo) => {
    for (const trilha of ["crescer", "mudar"]) {
      signMock.mockClear();
      await inserir(`tok-${area}-${trilha}`, area, trilha, "pago");
      const res = await pedir(`tok-${area}-${trilha}`);
      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe(`https://storage.example.test/signed/${arquivo}?token=fake`);
      expect(res.headers.get("cache-control")).toBe("no-store");
      expect(res.headers.get("referrer-policy")).toBe("no-referrer");
      expect(signMock).toHaveBeenCalledExactlyOnceWith(arquivo);
    }
  });

  it("pedido pago sem trilha ainda recebe o currículo (a trilha não decide)", async () => {
    await inserir("tok-sem-trilha", "financeiro", null, "pago");
    const res = await pedir("tok-sem-trilha");
    expect(res.status).toBe(302);
    expect(signMock).toHaveBeenCalledWith("Curriculo-ATS-Financeiro-Mudar-de-Empresa.docx");
  });

  it.each(["pendente", "cancelado", "expirado", "falhou"])("pedido %s: 404 e nada é assinado", async (status) => {
    await inserir(`tok-${status}`, "comercial", "mudar", status);
    const res = await pedir(`tok-${status}`);
    expect(res.status).toBe(404);
    expect(res.headers.get("location")).toBeNull();
    expect(signMock).not.toHaveBeenCalled();
  });

  it("pedido inexistente e pedido não pago recebem a MESMA resposta (sem enumeração)", async () => {
    await inserir("tok-pend", "financeiro", "crescer", "pendente");
    const inexistente = await pedir("tok-nao-existe");
    const pendente = await pedir("tok-pend");
    expect(inexistente.status).toBe(pendente.status);
    expect(await inexistente.json()).toEqual(await pendente.json());
  });

  it("pago com área desconhecida: 409 e nada é assinado", async () => {
    await inserir("tok-area-x", "area-inexistente", "crescer", "pago");
    const res = await pedir("tok-area-x");
    expect(res.status).toBe(409);
    expect(signMock).not.toHaveBeenCalled();
  });

  it("falha ao assinar no Storage: 503 sem vazar o motivo", async () => {
    await inserir("tok-falha", "financeiro", "mudar", "pago");
    signMock.mockRejectedValueOnce(new Error("Falha ao assinar o PDF (HTTP 500)."));
    const res = await pedir("tok-falha");
    expect(res.status).toBe(503);
    expect(JSON.stringify(await res.json())).not.toContain("HTTP 500");
  });
});
