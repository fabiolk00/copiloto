import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { NextRequest } from "next/server";
import type { PGlite } from "@electric-sql/pglite";
import type { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { startTestDb, stopTestDb, resetTestDb, TEST_SQL_GLOBAL_KEY } from "../helpers/test-db";
import { MPAuthenticationError, MPNotFoundError } from "mercadopago";
import { _resetRateLimitState } from "@/lib/rate-limit";
import {
  buildPixOrderGetResponseCancelled,
  buildPixOrderGetResponsePaid,
  buildPixOrderGetResponsePending,
} from "../helpers/mp-fixtures";

// Definido antes de qualquer import dinâmico da rota: lib/env lê no carregamento.
const SECRET = "segredo-de-teste-da-reconciliacao-0123456789abcdef";
process.env.RECONCILE_SECRET = SECRET;

const { orderGetMock } = vi.hoisted(() => ({ orderGetMock: vi.fn() }));

vi.mock("mercadopago", async (importOriginal) => {
  const actual = await importOriginal<typeof import("mercadopago")>();
  return {
    ...actual,
    MercadoPagoConfig: class {},
    Order: class {
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

// A rota agora também processa a fila de e-mail; estes testes olham só a parte de reconciliação.
function semEmail(json: Record<string, unknown>) {
  const { email: _email, ...resto } = json;
  void _email;
  return resto;
}

const PORT = 55612;
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
  orderGetMock.mockReset();
  _resetRateLimitState();
});

async function inserirPedido(opts: {
  token: string;
  mpOrderId: string | null;
  status?: string;
  expiresIn?: string; // intervalo SQL, ex.: "30 minutes" ou "-3 hours"
  reconciliadoEmAgo?: string | null; // ex.: "10 seconds"
  amount?: string;
}) {
  await sql`
    insert into pedidos (
      client_token, external_reference, area_slug, trilha, payer_email, amount, status, mp_order_id, expires_at, reconciliado_em
    ) values (
      ${opts.token}, ${opts.token + "-ref"}, 'financeiro', 'crescer', 'p@example.com', ${opts.amount ?? "29.90"},
      ${opts.status ?? "pendente"}, ${opts.mpOrderId},
      now() + ${opts.expiresIn ?? "30 minutes"}::interval,
      ${opts.reconciliadoEmAgo ? sql`now() - ${opts.reconciliadoEmAgo}::interval` : null}
    )
  `;
}

async function chamar(init?: { auth?: string | null }) {
  const { POST } = await import("@/app/api/internal/reconcile/route");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const auth = init?.auth === undefined ? `Bearer ${SECRET}` : init.auth;
  if (auth !== null) headers.authorization = auth;
  const res = await POST(new NextRequest("http://localhost/api/internal/reconcile", { method: "POST", headers, body: "{}" }));
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

async function status(token: string) {
  const [row] = await sql`select status from pedidos where client_token = ${token}`;
  return row.status as string;
}

describe("POST /api/internal/reconcile — autenticação", () => {
  it("sem Authorization: 401 e nenhuma consulta à Mercado Pago", async () => {
    await inserirPedido({ token: "t1", mpOrderId: "ORD-1" });
    const { status: st } = await chamar({ auth: null });
    expect(st).toBe(401);
    expect(orderGetMock).not.toHaveBeenCalled();
  });

  it("segredo errado: 401", async () => {
    const { status: st } = await chamar({ auth: "Bearer outro-segredo" });
    expect(st).toBe(401);
  });

  it("esquema que não é Bearer: 401", async () => {
    const { status: st } = await chamar({ auth: SECRET });
    expect(st).toBe(401);
  });

  it("sem RECONCILE_SECRET configurado a rota fica desligada (404), mesmo com qualquer Bearer", async () => {
    vi.resetModules();
    const antigo = process.env.RECONCILE_SECRET;
    delete process.env.RECONCILE_SECRET;
    try {
      const { POST } = await import("@/app/api/internal/reconcile/route");
      const res = await POST(
        new NextRequest("http://localhost/api/internal/reconcile", {
          method: "POST",
          headers: { authorization: `Bearer ${SECRET}` },
          body: "{}",
        })
      );
      expect(res.status).toBe(404);
    } finally {
      process.env.RECONCILE_SECRET = antigo;
      vi.resetModules();
    }
  });
});

describe("POST /api/internal/reconcile — reconciliação", () => {
  it("Pix pago na Mercado Pago com webhook perdido: o pedido vira pago", async () => {
    await inserirPedido({ token: "pago", mpOrderId: "ORD-0001" });
    orderGetMock.mockResolvedValueOnce(buildPixOrderGetResponsePaid());

    const { status: st, json } = await chamar();

    expect(st).toBe(200);
    expect(semEmail(json)).toEqual({ checked: 1, updated: 1, errors: 0 });
    expect(await status("pago")).toBe("pago");
    expect(orderGetMock).toHaveBeenCalledWith({ id: "ORD-0001" });
  });

  it("valor da order diferente do pedido: não marca como pago", async () => {
    await inserirPedido({ token: "valor", mpOrderId: "ORD-0001", amount: "29.90" });
    orderGetMock.mockResolvedValueOnce(buildPixOrderGetResponsePaid({ amount: "0.01" }));

    const { json } = await chamar();

    expect(json.updated).toBe(0);
    expect(await status("valor")).toBe("pendente");
  });

  it("order ainda pendente na Mercado Pago: nada muda, mas o pedido é marcado como conferido", async () => {
    await inserirPedido({ token: "pend", mpOrderId: "ORD-0001" });
    orderGetMock.mockResolvedValueOnce(buildPixOrderGetResponsePending());

    const { json } = await chamar();

    expect(semEmail(json)).toEqual({ checked: 1, updated: 0, errors: 0 });
    expect(await status("pend")).toBe("pendente");
    const [row] = await sql`select reconciliado_em from pedidos where client_token = 'pend'`;
    expect(row.reconciliado_em).not.toBeNull();
  });

  it("order cancelada na Mercado Pago: o pedido vira cancelado", async () => {
    await inserirPedido({ token: "canc", mpOrderId: "ORD-0001" });
    orderGetMock.mockResolvedValueOnce(buildPixOrderGetResponseCancelled());
    await chamar();
    expect(await status("canc")).toBe("cancelado");
  });

  it("falha da Mercado Pago em um pedido não derruba o lote nem altera o pedido", async () => {
    await inserirPedido({ token: "falha", mpOrderId: "ORD-FALHA" });
    await inserirPedido({ token: "ok", mpOrderId: "ORD-0001" });
    orderGetMock.mockImplementation(async ({ id }: { id: string }) => {
      if (id === "ORD-FALHA") throw new Error("MP fora do ar");
      return buildPixOrderGetResponsePaid();
    });

    const { status: st, json } = await chamar();

    expect(st).toBe(200);
    expect(semEmail(json)).toEqual({ checked: 2, updated: 1, errors: 1, errorStatuses: { sem_status: 1 } });
    expect(await status("falha")).toBe("pendente");
    expect(await status("ok")).toBe("pago");
  });

  it("agrupa os erros por código HTTP da Mercado Pago, para diagnosticar token errado (401) ou order inexistente (404)", async () => {
    await inserirPedido({ token: "e401", mpOrderId: "ORD-401" });
    await inserirPedido({ token: "e404a", mpOrderId: "ORD-404A" });
    await inserirPedido({ token: "e404b", mpOrderId: "ORD-404B" });
    orderGetMock.mockImplementation(async ({ id }: { id: string }) => {
      if (id === "ORD-401") throw new MPAuthenticationError({ message: "invalid access token", status: 401 });
      throw new MPNotFoundError({ message: "order not found", status: 404 });
    });

    const { json } = await chamar();

    expect(semEmail(json)).toEqual({ checked: 3, updated: 0, errors: 3, errorStatuses: { "401": 1, "404": 2 } });
  });

  it("a resposta de erro não contém token, URL nem id de pedido", async () => {
    await inserirPedido({ token: "vaza", mpOrderId: "ORD-SEGREDO-123" });
    orderGetMock.mockRejectedValue(new MPAuthenticationError({ message: "Bearer TEST-access-token inválido", status: 401 }));

    const { json } = await chamar();
    const texto = JSON.stringify(json);

    expect(texto).not.toContain("TEST-access-token");
    expect(texto).not.toContain("ORD-SEGREDO-123");
    expect(texto).not.toContain("http");
  });

  it("sem erros a resposta não traz o campo errorStatuses", async () => {
    await inserirPedido({ token: "limpo", mpOrderId: "ORD-0001" });
    orderGetMock.mockResolvedValueOnce(buildPixOrderGetResponsePending());
    const { json } = await chamar();
    expect("errorStatuses" in json).toBe(false);
  });

  it("uma segunda chamada logo em seguida não reconsulta (respiro de 30 s)", async () => {
    await inserirPedido({ token: "dup", mpOrderId: "ORD-0001" });
    orderGetMock.mockResolvedValue(buildPixOrderGetResponsePending());

    await chamar();
    const again = await chamar();

    expect(semEmail(again.json)).toEqual({ checked: 0, updated: 0, errors: 0 });
    expect(orderGetMock).toHaveBeenCalledTimes(1);
  });

  it("a resposta traz só contagens, sem ids, e-mails nem URLs", async () => {
    await inserirPedido({ token: "priv", mpOrderId: "ORD-0001" });
    orderGetMock.mockResolvedValueOnce(buildPixOrderGetResponsePaid());
    const { json } = await chamar();
    expect(Object.keys(json).sort()).toEqual(["checked", "email", "errors", "updated"]);
    // O bloco de e-mail também traz só contagens.
    expect(Object.values(json.email as Record<string, unknown>).every((v) => typeof v === "number" || typeof v === "string")).toBe(true);
  });
});

describe("view pedidos_a_reconciliar (critério de candidatos)", () => {
  async function candidatos() {
    const rows = await sql`select mp_order_id from pedidos_a_reconciliar order by mp_order_id`;
    return rows.map((r) => r.mp_order_id as string);
  }

  it("inclui pendente com order, dentro da validade e nunca conferido", async () => {
    await inserirPedido({ token: "a", mpOrderId: "ORD-A" });
    expect(await candidatos()).toEqual(["ORD-A"]);
  });

  it("inclui pendente vencido há menos de 1 hora (pagamento perto do vencimento com webhook atrasado)", async () => {
    await inserirPedido({ token: "b", mpOrderId: "ORD-B", expiresIn: "-30 minutes" });
    expect(await candidatos()).toEqual(["ORD-B"]);
  });

  it("exclui vencido há mais de 1 hora, sem order, e status final", async () => {
    await inserirPedido({ token: "c", mpOrderId: "ORD-C", expiresIn: "-3 hours" });
    await inserirPedido({ token: "d", mpOrderId: null });
    await inserirPedido({ token: "e", mpOrderId: "ORD-E", status: "pago" });
    await inserirPedido({ token: "f", mpOrderId: "ORD-F", status: "cancelado" });
    expect(await candidatos()).toEqual([]);
  });

  it("exclui conferido há menos de 30 s e inclui conferido há mais de 30 s", async () => {
    await inserirPedido({ token: "g", mpOrderId: "ORD-G", reconciliadoEmAgo: "10 seconds" });
    await inserirPedido({ token: "h", mpOrderId: "ORD-H", reconciliadoEmAgo: "2 minutes" });
    expect(await candidatos()).toEqual(["ORD-H"]);
  });
});
