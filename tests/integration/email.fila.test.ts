import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import type { PGlite } from "@electric-sql/pglite";
import type { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { startTestDb, stopTestDb, resetTestDb, TEST_SQL_GLOBAL_KEY } from "../helpers/test-db";
import type { EmailSender, SendResult } from "@/lib/email";

vi.mock("@/lib/db", () => ({
  get sql() {
    return (globalThis as Record<string, unknown>)[TEST_SQL_GLOBAL_KEY];
  },
}));

const PORT = 55615;
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
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

const APP_URL = "https://app.example.test";
const PAGO = { transactions: { payments: [{ status: "approved", status_detail: "accredited", amount: "29.90" }] } };

async function criar(n: number, status = "pendente", email = `p${n}@example.com`) {
  await sql`
    insert into pedidos (client_token, external_reference, area_slug, trilha, payer_email, amount, status, mp_order_id, expires_at)
    values (${`00000000-0000-4000-8000-${String(n).padStart(12, "0")}`}, ${`ref-${n}`}, 'financeiro', 'crescer', ${email}, 29.90, ${status}, ${`ORD-${n}`}, now() + interval '30 minutes')
  `;
  return `ORD-${n}`;
}
const linha = async (n: number) =>
  (await sql`select * from pedidos where mp_order_id = ${`ORD-${n}`}`)[0] as Record<string, unknown>;
const OK = (id = "em_1"): SendResult => ({ ok: true, id });
const sender = (fn: (m: Parameters<EmailSender>[0], i: number) => SendResult | Promise<SendResult>) => {
  const calls: Parameters<EmailSender>[0][] = [];
  const s: EmailSender = async (m) => {
    calls.push(m);
    return fn(m, calls.length - 1);
  };
  return Object.assign(s, { calls });
};

async function rodar(s: EmailSender, extra: Record<string, unknown> = {}) {
  const { processEmailQueue } = await import("@/lib/email-queue");
  return processEmailQueue({ sender: s, appUrl: APP_URL, rand: () => 0.5, ...extra });
}
async function avancarFila(n: number) {
  await sql`update pedidos set email_proxima_tentativa = now() - interval '1 second' where mp_order_id = ${`ORD-${n}`}`;
}

describe("entrada na fila", () => {
  it("o pagamento enfileira o e-mail na mesma instrução da transição", async () => {
    const { applyMpOrder } = await import("@/lib/reconcile");
    await criar(1);
    expect((await linha(1)).email_status).toBeNull();
    expect(await applyMpOrder("ORD-1", PAGO)).toBe("atualizado");
    const p = await linha(1);
    expect(p.status).toBe("pago");
    expect(p.email_status).toBe("pendente");
    expect(p.email_proxima_tentativa).not.toBeNull();
  });

  it("duas confirmações simultâneas do mesmo pedido geram exatamente um item de fila", async () => {
    const { applyMpOrder } = await import("@/lib/reconcile");
    await criar(2);
    const r = await Promise.all([applyMpOrder("ORD-2", PAGO), applyMpOrder("ORD-2", PAGO), applyMpOrder("ORD-2", PAGO)]);
    expect(r.filter((x) => x === "atualizado")).toHaveLength(1);
    const s = sender(() => OK("em_2"));
    const resumo = await rodar(s);
    expect(resumo.enviados).toBe(1);
    expect(s.calls).toHaveLength(1);
  });

  it("expirado -> pago também enfileira (pagamento atrasado recebe o guia)", async () => {
    const { applyMpOrder } = await import("@/lib/reconcile");
    await criar(3, "expirado");
    await applyMpOrder("ORD-3", PAGO);
    expect((await linha(3)).email_status).toBe("pendente");
  });

  it("pedido que já estava pago antes do outbox NÃO é enfileirado (o backfill é manual)", async () => {
    await criar(4, "pago");
    const s = sender(() => OK());
    const resumo = await rodar(s);
    expect(resumo.enviados).toBe(0);
    expect(s.calls).toHaveLength(0);
    expect((await linha(4)).email_status).toBeNull();
  });

  it("não enfileira pedido que não é pago", async () => {
    const { markPedidoStatus } = await import("@/lib/pedidos");
    await criar(5);
    await markPedidoStatus("ORD-5", "cancelado");
    expect((await linha(5)).email_status).toBeNull();
  });

  it("um segundo pagamento (replay) não reabre um e-mail já tratado", async () => {
    const { applyMpOrder } = await import("@/lib/reconcile");
    await criar(6);
    await applyMpOrder("ORD-6", PAGO);
    await rodar(sender(() => OK("em_6")));
    await applyMpOrder("ORD-6", PAGO);
    expect((await linha(6)).email_status).toBe("enviado");
  });
});

describe("envio", () => {
  async function pago(n: number) {
    const { applyMpOrder } = await import("@/lib/reconcile");
    await criar(n);
    await applyMpOrder(`ORD-${n}`, PAGO);
  }

  it("sucesso: grava resend_email_id e marca enviado; destinatário é o payer_email; link aponta para /guia", async () => {
    await pago(10);
    const s = sender(() => OK("em_10"));
    await rodar(s);
    const p = await linha(10);
    expect(p).toMatchObject({ email_status: "enviado", resend_email_id: "em_10", email_tentativas: 1 });
    expect(p.email_enviado_em).not.toBeNull();
    expect(s.calls[0].to).toBe("p10@example.com");
    expect(s.calls[0].html).toContain(`${APP_URL}/api/orders/00000000-0000-4000-8000-000000000010/guia`);
    expect(s.calls[0].idempotencyKey).toBe(`guia-pago/${p.id}`);
  });

  it("dois workers ao mesmo tempo: o pedido é enviado uma única vez", async () => {
    await pago(11);
    const s = sender(() => OK("em_11"));
    const [a, b] = await Promise.all([rodar(s), rodar(s)]);
    expect(a.enviados + b.enviados).toBe(1);
    expect(s.calls).toHaveLength(1);
  });

  it("processo morre depois do envio e antes da gravação: a nova execução reusa a mesma chave (sem duplicar)", async () => {
    await pago(12);
    const chaves: string[] = [];
    // 1ª execução: o Resend aceita, mas o worker "morre" antes de gravar (simulado: o sender lança).
    const morre = sender((m) => {
      chaves.push(m.idempotencyKey);
      throw new Error("processo morreu");
    });
    await expect(rodar(morre)).rejects.toThrow("processo morreu");
    expect((await linha(12)).email_status).toBe("enviando");

    // Nada elegível enquanto o lease vale.
    const s2 = sender(() => OK("em_12"));
    expect((await rodar(s2)).enviados).toBe(0);

    // Lease vence: volta à fila e reenvia com a MESMA chave (o Resend devolve a resposta guardada).
    await sql`update pedidos set email_lock_ate = now() - interval '1 second' where mp_order_id = 'ORD-12'`;
    const s3 = sender((m) => {
      chaves.push(m.idempotencyKey);
      return OK("em_12");
    });
    await rodar(s3);
    expect(chaves[0]).toBe(chaves[1]);
    expect(await linha(12)).toMatchObject({ email_status: "enviado", resend_email_id: "em_12", email_tentativas: 2 });
  });

  it("o corpo é idêntico entre tentativas da mesma chave", async () => {
    await pago(13);
    const corpos: string[] = [];
    const falha = sender((m) => {
      corpos.push(m.html + m.text + m.subject);
      return { ok: false, kind: "transitorio", detail: "HTTP 503" };
    });
    await rodar(falha);
    await avancarFila(13);
    const ok = sender((m) => {
      corpos.push(m.html + m.text + m.subject);
      return OK("em_13");
    });
    await rodar(ok);
    expect(corpos[0]).toBe(corpos[1]);
  });

  it("erro transitório: volta à fila com backoff e consome tentativa; depois de 6, falhou", async () => {
    await pago(14);
    const s = sender(() => ({ ok: false, kind: "transitorio", detail: "HTTP 503" }));
    await rodar(s);
    let p = await linha(14);
    expect(p).toMatchObject({ email_status: "pendente", email_tentativas: 1 });
    const espera = await sql`select extract(epoch from (email_proxima_tentativa - now()))::int as s from pedidos where mp_order_id = 'ORD-14'`;
    expect(espera[0].s).toBeGreaterThan(50);
    expect(espera[0].s).toBeLessThanOrEqual(60);
    // Mais 5 tentativas até esgotar.
    for (let i = 2; i <= 6; i += 1) {
      await avancarFila(14);
      await rodar(s);
    }
    p = await linha(14);
    expect(p).toMatchObject({ email_status: "falhou", email_tentativas: 6 });
    expect(String(p.email_ultimo_erro)).toContain("tentativas_esgotadas");
    expect(s.calls).toHaveLength(6);
  });

  it("erro permanente: falhou na hora, sem retry", async () => {
    await pago(15);
    const s = sender(() => ({ ok: false, kind: "permanente", detail: "HTTP 409 invalid_idempotent_request" }));
    await rodar(s);
    expect(await linha(15)).toMatchObject({ email_status: "falhou", email_tentativas: 1 });
    await avancarFila(15);
    await rodar(s);
    expect(s.calls).toHaveLength(1);
  });

  it("429 por taxa respeita retry-after, NÃO consome tentativa e pausa a execução", async () => {
    await pago(16);
    await pago(17);
    const s = sender(() => ({ ok: false, kind: "taxa", retryAfterSec: 30, detail: "rate_limit" }));
    const r = await rodar(s);
    expect(r.pausa).toBe("taxa");
    expect(s.calls).toHaveLength(1);
    const p = await linha(16);
    expect(p).toMatchObject({ email_status: "pendente", email_tentativas: 0 });
    const espera = await sql`select extract(epoch from (email_proxima_tentativa - now()))::int as s from pedidos where mp_order_id = 'ORD-16'`;
    expect(espera[0].s).toBeGreaterThan(25);
    expect(espera[0].s).toBeLessThanOrEqual(30);
    // O segundo pedido nem foi reivindicado.
    expect((await linha(17)).email_status).toBe("pendente");
    expect((await linha(17)).email_tentativas).toBe(0);
  });

  it("cota diária esgotada: pausa a fila, não consome tentativa e alerta em log", async () => {
    await pago(18);
    const s = sender(() => ({ ok: false, kind: "cota", detail: "daily_quota_exceeded" }));
    const r = await rodar(s);
    expect(r.pausa).toBe("cota");
    expect(await linha(18)).toMatchObject({ email_status: "pendente", email_tentativas: 0 });
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("COTA"), expect.anything());
    const espera = await sql`select extract(epoch from (email_proxima_tentativa - now()))::int as s from pedidos where mp_order_id = 'ORD-18'`;
    expect(espera[0].s).toBeGreaterThan(3000);
  });

  it("erro de configuração (401/403): pausa 15 min, não consome tentativa, alerta alto", async () => {
    await pago(19);
    const s = sender(() => ({ ok: false, kind: "configuracao", detail: "HTTP 401 invalid_api_key" }));
    const r = await rodar(s);
    expect(r.pausa).toBe("configuracao");
    expect(await linha(19)).toMatchObject({ email_status: "pendente", email_tentativas: 0 });
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("CONFIGURAÇÃO"), expect.anything());
  });

  it("sem APP_URL: configuração, sem chamar o provedor", async () => {
    await pago(20);
    const s = sender(() => OK());
    const { processEmailQueue } = await import("@/lib/email-queue");
    const r = await processEmailQueue({ sender: s, appUrl: "", rand: () => 0.5 });
    expect(r.pausa).toBe("configuracao");
    expect(s.calls).toHaveLength(0);
    expect((await linha(20)).email_tentativas).toBe(0);
  });

  it("payer_email com CR/LF no banco é recusado antes do envio", async () => {
    await criar(21, "pendente", "a@b.com\r\nBcc: x@y.com");
    const { applyMpOrder } = await import("@/lib/reconcile");
    await applyMpOrder("ORD-21", PAGO);
    const s = sender(() => OK());
    await rodar(s);
    expect(s.calls).toHaveLength(0);
    expect((await linha(21)).email_status).toBe("falhou");
  });

  it("log nunca traz e-mail completo, link nem token", async () => {
    await pago(22);
    await rodar(sender(() => ({ ok: false, kind: "transitorio", detail: "HTTP 503" })));
    const saida = JSON.stringify([...(console.warn as ReturnType<typeof vi.fn>).mock.calls, ...(console.error as ReturnType<typeof vi.fn>).mock.calls]);
    expect(saida).not.toContain("p22@example.com");
    expect(saida).not.toContain("00000000-0000-4000-8000-000000000022");
    expect(saida).not.toContain("/guia");
  });

  it("respeita o teto de envios por execução", async () => {
    for (const n of [30, 31, 32, 33]) await pago(n);
    const s = sender((_m, i) => OK(`em_t${i}`));
    const r = await rodar(s, { limit: 2 });
    expect(r.enviados).toBe(2);
    expect(s.calls).toHaveLength(2);
  });

  it("estourou o orçamento de tempo: não começa outro envio", async () => {
    await pago(40);
    await pago(41);
    let t = 0;
    const s = sender(() => OK("em_x"));
    const r = await rodar(s, { now: () => (t += 5000), budgetMs: 8000 });
    expect(r.pausa).toBe("orcamento");
    expect(s.calls.length).toBeLessThan(2);
  });
});

describe("payer_email e savePixAttempt", () => {
  const tentativa = (id: number, payerEmail: string) => ({
    id,
    payerEmail,
    areaSlug: "financeiro",
    trilha: "crescer" as const,
    attempt: 2,
    externalReference: "ref-nova",
    mpOrderId: "ORD-NOVO",
    qrCode: "qr",
    qrCodeBase64: "b64",
    ticketUrl: null,
    expiresAt: new Date(Date.now() + 60_000),
  });

  it("nova tentativa antes do pagamento atualiza o e-mail", async () => {
    const { savePixAttempt } = await import("@/lib/pedidos");
    await criar(50, "expirado", "antigo@example.com");
    const id = (await linha(50)).id as number;
    const row = await savePixAttempt(tentativa(id, "novo@example.com"));
    expect(row?.payer_email).toBe("novo@example.com");
  });

  it("depois de pago, o e-mail nunca muda e o pedido não volta a pendente", async () => {
    const { savePixAttempt } = await import("@/lib/pedidos");
    await criar(51, "pago", "pago@example.com");
    const id = (await linha(51)).id as number;
    expect(await savePixAttempt(tentativa(id, "outro@example.com"))).toBeUndefined();
    expect(await linha(51)).toMatchObject({ status: "pago", payer_email: "pago@example.com" });
  });
});
