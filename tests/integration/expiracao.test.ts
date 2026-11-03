import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { NextRequest } from "next/server";
import type { PGlite } from "@electric-sql/pglite";
import type { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { startTestDb, stopTestDb, resetTestDb, TEST_SQL_GLOBAL_KEY } from "../helpers/test-db";
import { buildSignatureHeader } from "../helpers/mp-signature";
import {
  buildPixOrderCreateResponse,
  buildPixOrderGetResponseCancelled,
  buildPixOrderGetResponsePaid,
  buildPixOrderGetResponsePending,
} from "../helpers/mp-fixtures";
import { _resetRateLimitState } from "@/lib/rate-limit";
import { markPedidoStatus } from "@/lib/pedidos";

const { orderGetMock, orderCreateMock } = vi.hoisted(() => ({ orderGetMock: vi.fn(), orderCreateMock: vi.fn() }));

vi.mock("mercadopago", async (importOriginal) => {
  const actual = await importOriginal<typeof import("mercadopago")>();
  return {
    ...actual,
    MercadoPagoConfig: class {},
    Order: class {
      get(args: unknown) {
        return orderGetMock(args);
      }
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

// Só a chamada de rede ao Storage é substituída.
vi.mock("@/lib/storage", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/storage")>();
  return { ...real, createSignedPdfUrl: async (p: string) => `https://storage.example.test/${p}?token=fake` };
});

const PORT = 55613;
const WEBHOOK_SECRET = "test-webhook-secret";
let sql: postgres.Sql;
let db: PGlite;
let server: PGLiteSocketServer;
let seq = 0;

beforeAll(async () => {
  ({ sql, db, server } = await startTestDb(PORT));
});

afterAll(async () => {
  await stopTestDb({ sql, db, server });
});

beforeEach(async () => {
  await resetTestDb(sql);
  orderGetMock.mockReset();
  orderCreateMock.mockReset();
  _resetRateLimitState();
});

type NovoPedido = {
  token: string;
  mpOrderId?: string | null;
  status?: string;
  /** Intervalo SQL somado a now() para expires_at, ex.: "-2 hours". `null` = sem expires_at. */
  expira?: string | null;
  /** Intervalo SQL somado a now() para created_at. */
  criado?: string;
  amount?: string;
  area?: string;
  trilha?: string | null;
  reconciliadoHa?: string | null;
};

async function inserir(p: NovoPedido) {
  seq += 1;
  const mp = p.mpOrderId === undefined ? `ORD-${String(seq).padStart(4, "0")}` : p.mpOrderId;
  const expira = p.expira === undefined ? "30 minutes" : p.expira;
  await sql`
    insert into pedidos (
      client_token, external_reference, area_slug, trilha, payer_email, amount, status, mp_order_id,
      expires_at, created_at, reconciliado_em
    ) values (
      ${p.token}, ${p.token + "-ref"}, ${p.area ?? "financeiro"}, ${p.trilha === undefined ? "crescer" : p.trilha},
      'comprador@example.com', ${p.amount ?? "29.90"}, ${p.status ?? "pendente"}, ${mp},
      ${expira === null ? null : sql`now() + ${expira}::interval`},
      now() + ${p.criado ?? "0 seconds"}::interval,
      ${p.reconciliadoHa ? sql`now() - ${p.reconciliadoHa}::interval` : null}
    )
  `;
  // Nos testes que passam `mpOrderId: null` o retorno não é usado.
  return mp as string;
}

async function expirar(): Promise<number> {
  const [r] = await sql`select public.expirar_pedidos_pendentes() as n`;
  return r.n as number;
}

async function statusDe(token: string): Promise<string> {
  const [r] = await sql`select status from pedidos where client_token = ${token}`;
  return r.status as string;
}

async function candidatos(): Promise<Set<string>> {
  const rows = await sql`select mp_order_id from pedidos_a_reconciliar`;
  return new Set(rows.map((r) => r.mp_order_id as string));
}

async function webhook(dataId: string, action = "order.processed", requestId = `req-${++seq}`) {
  const { POST } = await import("@/app/api/webhooks/mercadopago/route");
  const { xSignature } = buildSignatureHeader({ dataId, requestId, secret: WEBHOOK_SECRET });
  const res = await POST(
    new NextRequest(`http://localhost/api/webhooks/mercadopago?data.id=${encodeURIComponent(dataId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-signature": xSignature, "x-request-id": requestId },
      body: JSON.stringify({ action, type: "order", data: { id: dataId }, live_mode: true }),
    })
  );
  return res.status;
}

async function download(token: string) {
  const { GET } = await import("@/app/api/orders/[id]/download/route");
  const res = await GET(new NextRequest(`http://localhost/api/orders/${token}/download`), {
    params: Promise.resolve({ id: token }),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

async function statusRoute(token: string) {
  const { GET } = await import("@/app/api/orders/[id]/status/route");
  const res = await GET(new NextRequest(`http://localhost/api/orders/${token}/status`), {
    params: Promise.resolve({ id: token }),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

async function criarPix(body: Record<string, unknown>) {
  const { POST } = await import("@/app/api/pix/create/route");
  const res = await POST(
    new NextRequest("http://localhost/api/pix/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
  return { status: res.status, json: await res.json().catch(() => null) };
}

// ---------------------------------------------------------------------------
// GOLDEN: o caminho esperado, de ponta a ponta
// ---------------------------------------------------------------------------
describe("golden — expiração por relógio", () => {
  it("pendente vencido há mais de 1 hora vira expirado e a função devolve quantos mudou", async () => {
    await inserir({ token: "a", expira: "-2 hours" });
    await inserir({ token: "b", expira: "-1 day" });
    expect(await expirar()).toBe(2);
    expect(await statusDe("a")).toBe("expirado");
    expect(await statusDe("b")).toBe("expirado");
  });

  it("pendente dentro da validade não muda", async () => {
    await inserir({ token: "ok", expira: "20 minutes" });
    expect(await expirar()).toBe(0);
    expect(await statusDe("ok")).toBe("pendente");
  });

  it("pendente vencido há menos de 1 hora continua pendente (ainda está na janela de conferência)", async () => {
    await inserir({ token: "janela", expira: "-30 minutes" });
    expect(await expirar()).toBe(0);
    expect(await statusDe("janela")).toBe("pendente");
  });

  it("status finais nunca mudam, mesmo vencidos há dias: pago nunca é rebaixado", async () => {
    for (const st of ["pago", "cancelado", "falhou", "expirado"]) {
      await inserir({ token: `fim-${st}`, status: st, expira: "-5 days" });
    }
    expect(await expirar()).toBe(0);
    for (const st of ["pago", "cancelado", "falhou", "expirado"]) {
      expect(await statusDe(`fim-${st}`)).toBe(st);
    }
  });

  it("ciclo completo: pendente -> expirado pelo job -> pago pelo webhook tardio -> download liberado", async () => {
    const mp = await inserir({ token: "ciclo", expira: "-2 hours", area: "comercial", trilha: "mudar" });
    await expirar();
    expect(await statusDe("ciclo")).toBe("expirado");
    expect((await download("ciclo")).status).toBe(402); // expirado ainda não entrega

    orderGetMock.mockResolvedValueOnce(buildPixOrderGetResponsePaid());
    expect(await webhook(mp)).toBe(200);

    expect(await statusDe("ciclo")).toBe("pago");
    const dl = await download("ciclo");
    expect(dl.status).toBe(200);
    expect(dl.json.url).toContain("Guia-Carreira-Comercial-Mudar-de-Empresa.pdf");
  });
});

// ---------------------------------------------------------------------------
// EDGE: limites e entradas incomuns
// ---------------------------------------------------------------------------
describe("edge — limites da regra", () => {
  it("fronteira de 1 hora: 59 minutos depois do vencimento não expira, 61 minutos expira", async () => {
    await inserir({ token: "m59", expira: "-59 minutes" });
    await inserir({ token: "m61", expira: "-61 minutes" });
    expect(await expirar()).toBe(1);
    expect(await statusDe("m59")).toBe("pendente");
    expect(await statusDe("m61")).toBe("expirado");
  });

  it("sem expires_at (Pix nunca salvo): usa created_at — antigo expira, recente não", async () => {
    await inserir({ token: "sem-exp-velho", expira: null, mpOrderId: null, criado: "-3 hours" });
    await inserir({ token: "sem-exp-novo", expira: null, mpOrderId: null, criado: "-5 minutes" });
    expect(await expirar()).toBe(1);
    expect(await statusDe("sem-exp-velho")).toBe("expirado");
    expect(await statusDe("sem-exp-novo")).toBe("pendente");
  });

  it("pedido sem order na Mercado Pago, vencido, também expira", async () => {
    await inserir({ token: "sem-mp", mpOrderId: null, expira: "-2 hours" });
    expect(await expirar()).toBe(1);
    expect(await statusDe("sem-mp")).toBe("expirado");
  });

  it("é idempotente: rodar de novo não altera nada", async () => {
    await inserir({ token: "idem", expira: "-2 hours" });
    expect(await expirar()).toBe(1);
    expect(await expirar()).toBe(0);
    expect(await statusDe("idem")).toBe("expirado");
  });

  it("tabela vazia: devolve 0 sem erro", async () => {
    expect(await expirar()).toBe(0);
  });

  it("lote grande: só os elegíveis mudam e a contagem bate", async () => {
    for (let i = 0; i < 50; i++) await inserir({ token: `v${i}`, expira: "-2 hours" });
    for (let i = 0; i < 50; i++) await inserir({ token: `n${i}`, expira: "10 minutes" });
    expect(await expirar()).toBe(50);
    const [r] = await sql`select count(*)::int as n from pedidos where status = 'pendente'`;
    expect(r.n).toBe(50);
  });

  it("invariante com a reconciliação: cada pendente com order está na janela de conferência OU é expirado, nunca nos dois nem em nenhum", async () => {
    const offsets = ["-300 minutes", "-120 minutes", "-61 minutes", "-60 minutes", "-59 minutes", "-30 minutes", "-1 minutes", "5 minutes", "30 minutes"];
    for (const [i, o] of offsets.entries()) await inserir({ token: `inv${i}`, expira: o });

    const antes = await candidatos(); // sem throttle: reconciliado_em nulo
    const mpPorToken = new Map<string, string>();
    for (const r of await sql`select client_token, mp_order_id from pedidos`) mpPorToken.set(r.client_token, r.mp_order_id);

    await expirar();

    for (const [token, mp] of mpPorToken) {
      const naJanela = antes.has(mp);
      const expirou = (await statusDe(token)) === "expirado";
      expect(naJanela !== expirou, `pedido ${token}: naJanela=${naJanela} expirou=${expirou}`).toBe(true);
    }
  });

  it("pedido já expirado não é candidato da reconciliação", async () => {
    await inserir({ token: "exp-cand", status: "expirado", expira: "-10 minutes" });
    expect((await candidatos()).size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// SHADOW: cenários raros que custam dinheiro se falharem
// ---------------------------------------------------------------------------
describe("shadow — promoção expirado -> pago e proteção do pago", () => {
  it("pagamento confirmado depois de expirar promove expirado -> pago", async () => {
    const mp = await inserir({ token: "tardio", status: "expirado", expira: "-3 hours" });
    orderGetMock.mockResolvedValueOnce(buildPixOrderGetResponsePaid());
    expect(await webhook(mp)).toBe(200);
    expect(await statusDe("tardio")).toBe("pago");
  });

  it("pagamento tardio com valor divergente NÃO promove: continua expirado", async () => {
    const mp = await inserir({ token: "valor", status: "expirado", expira: "-3 hours", amount: "29.90" });
    orderGetMock.mockResolvedValueOnce(buildPixOrderGetResponsePaid({ amount: "0.01" }));
    expect(await webhook(mp)).toBe(200);
    expect(await statusDe("valor")).toBe("expirado");
  });

  it("notificação de cancelado ou pendente sobre pedido expirado não muda nada", async () => {
    const mpA = await inserir({ token: "canc", status: "expirado", expira: "-3 hours" });
    orderGetMock.mockResolvedValueOnce(buildPixOrderGetResponseCancelled());
    await webhook(mpA, "order.canceled");
    expect(await statusDe("canc")).toBe("expirado");

    const mpB = await inserir({ token: "pend", status: "expirado", expira: "-3 hours" });
    orderGetMock.mockResolvedValueOnce(buildPixOrderGetResponsePending());
    await webhook(mpB, "order.created");
    expect(await statusDe("pend")).toBe("expirado");
  });

  it("markPedidoStatus: só 'pago' sai de expirado; cancelado e falhou não", async () => {
    const mp = await inserir({ token: "mk", status: "expirado", expira: "-3 hours" });
    expect(await markPedidoStatus(mp, "cancelado")).toBeUndefined();
    expect(await markPedidoStatus(mp, "falhou")).toBeUndefined();
    expect(await statusDe("mk")).toBe("expirado");
    expect((await markPedidoStatus(mp, "pago"))?.status).toBe("pago");
  });

  it("pago é terminal: nenhuma transição sai de pago", async () => {
    const mp = await inserir({ token: "terminal", status: "pago", expira: "-3 hours" });
    for (const st of ["pendente", "cancelado", "falhou", "expirado"] as const) {
      expect(await markPedidoStatus(mp, st)).toBeUndefined();
    }
    expect(await statusDe("terminal")).toBe("pago");
  });

  it("ordem das operações não importa: webhook antes do job ou job antes do webhook terminam em pago", async () => {
    // job -> webhook
    const mp1 = await inserir({ token: "ordem1", expira: "-2 hours" });
    await expirar();
    orderGetMock.mockResolvedValueOnce(buildPixOrderGetResponsePaid());
    await webhook(mp1);
    expect(await statusDe("ordem1")).toBe("pago");

    // webhook -> job (o job não rebaixa o pago)
    const mp2 = await inserir({ token: "ordem2", expira: "-2 hours" });
    orderGetMock.mockResolvedValueOnce(buildPixOrderGetResponsePaid());
    await webhook(mp2);
    await expirar();
    expect(await statusDe("ordem2")).toBe("pago");
  });

  it("webhook de pagamento repetido depois da promoção é no-op (consulta a Mercado Pago uma vez)", async () => {
    const mp = await inserir({ token: "rep", status: "expirado", expira: "-3 hours" });
    orderGetMock.mockResolvedValue(buildPixOrderGetResponsePaid());
    await webhook(mp, "order.processed", "req-a");
    await webhook(mp, "order.processed", "req-b");
    expect(await statusDe("rep")).toBe("pago");
    expect(orderGetMock).toHaveBeenCalledTimes(1);
  });

  it("nova tentativa de Pix sobre pedido expirado volta a pendente com nova validade, e o job não a expira", async () => {
    const token = "33333333-3333-4333-8333-333333333333";
    await inserir({ token, status: "expirado", expira: "-3 hours", area: "financeiro", trilha: "crescer" });
    orderCreateMock.mockResolvedValueOnce(buildPixOrderCreateResponse({ id: "ORD-NOVA", externalReference: `${token}-a2` }));

    const r = await criarPix({ area: "comercial", trilha: "mudar", payerEmail: "novo@example.com", clientToken: token });
    expect(r.status).toBe(200);

    const [row] = await sql`select status, attempt, area_slug, trilha, mp_order_id, expires_at > now() as valido from pedidos where client_token = ${token}`;
    expect(row.status).toBe("pendente");
    expect(row.attempt).toBe(2);
    expect(row.area_slug).toBe("comercial");
    expect(row.trilha).toBe("mudar");
    expect(row.mp_order_id).toBe("ORD-NOVA");
    expect(row.valido).toBe(true);

    expect(await expirar()).toBe(0);
    expect(await statusDe(token)).toBe("pendente");
  });

  it("a rota de status expõe 'expirado' e a de download recusa com 402", async () => {
    await inserir({ token: "vis", status: "expirado", expira: "-3 hours" });
    const s = await statusRoute("vis");
    expect(s.status).toBe(200);
    expect(s.json.status).toBe("expirado");
    expect((await download("vis")).status).toBe(402);
  });

  it("applyMpOrder só conta 'atualizado' quando a linha mudou de fato (replay e transição vetada são sem_mudanca)", async () => {
    const { applyMpOrder } = await import("@/lib/reconcile");

    const mpPago = await inserir({ token: "ja-pago", status: "pago", expira: "-3 hours" });
    expect(await applyMpOrder(mpPago, buildPixOrderGetResponsePaid())).toBe("sem_mudanca");

    const mpExp = await inserir({ token: "exp-canc", status: "expirado", expira: "-3 hours" });
    expect(await applyMpOrder(mpExp, buildPixOrderGetResponseCancelled())).toBe("sem_mudanca");

    const mpPend = await inserir({ token: "pend-pago", expira: "10 minutes" });
    expect(await applyMpOrder(mpPend, buildPixOrderGetResponsePaid())).toBe("atualizado");
  });

  it("pedido pago nunca perde o guia, mesmo vencido há dias e depois de rodar o job", async () => {
    await inserir({ token: "guardado", status: "pago", expira: "-9 days", area: "analise-de-dados", trilha: "crescer" });
    await expirar();
    const dl = await download("guardado");
    expect(dl.status).toBe(200);
    expect(dl.json.url).toContain("Guia-Carreira-Analise-de-Dados-Crescer-na-Empresa.pdf");
  });
});
