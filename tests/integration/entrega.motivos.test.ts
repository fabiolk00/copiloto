import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import type { PGlite } from "@electric-sql/pglite";
import type { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { startTestDb, stopTestDb, resetTestDb, TEST_SQL_GLOBAL_KEY } from "../helpers/test-db";

vi.mock("@/lib/db", () => ({
  get sql() {
    return (globalThis as Record<string, unknown>)[TEST_SQL_GLOBAL_KEY];
  },
}));

const signMock = vi.fn(async (path: string) => `https://storage.example.test/signed/${path}`);
vi.mock("@/lib/storage", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/storage")>();
  return { ...real, createSignedPdfUrl: (path: string) => signMock(path) };
});

// Porta própria desta suíte (55601 a 55613 já estão em uso).
const PORT = 55614;
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

// O mutante "remover a checagem trilha_ausente" sobrevivia porque, sem ela, o
// resolveGuiaPdf(…, null) devolve null e a rota ainda respondia 409 (com outro
// motivo). Estes testes fixam o motivo exato e a ordem das checagens.
describe("getEntregaPdfUrl: motivos de recusa", () => {
  it("pago sem trilha: motivo trilha_ausente (não guia_sem_arquivo)", async () => {
    await inserir("tok-a", "financeiro", null, "pago");
    const { getEntregaPdfUrl } = await import("@/lib/entrega");
    expect(await getEntregaPdfUrl("tok-a")).toEqual({ ok: false, reason: "trilha_ausente" });
    expect(signMock).not.toHaveBeenCalled();
  });

  it("pago com área desconhecida: motivo guia_sem_arquivo", async () => {
    await inserir("tok-b", "area-inexistente", "crescer", "pago");
    const { getEntregaPdfUrl } = await import("@/lib/entrega");
    expect(await getEntregaPdfUrl("tok-b")).toEqual({ ok: false, reason: "guia_sem_arquivo" });
    expect(signMock).not.toHaveBeenCalled();
  });

  it("não pago e sem trilha: o status vence (pagamento_pendente), nada é revelado sobre a trilha", async () => {
    await inserir("tok-c", "financeiro", null, "pendente");
    const { getEntregaPdfUrl } = await import("@/lib/entrega");
    expect(await getEntregaPdfUrl("tok-c")).toEqual({ ok: false, reason: "pagamento_pendente" });
  });

  it("rota: pago sem trilha responde 409 com a mensagem de trilha", async () => {
    await inserir("tok-d", "comercial", null, "pago");
    const { NextRequest } = await import("next/server");
    const { GET } = await import("@/app/api/orders/[id]/download/route");
    const res = await GET(new NextRequest("http://localhost/api/orders/tok-d/download"), {
      params: Promise.resolve({ id: "tok-d" }),
    });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("Pedido sem trilha definida.");
  });
});
