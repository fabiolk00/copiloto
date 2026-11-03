import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
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

const signMock = vi.fn(async (path: string) => `https://storage.example.test/signed/${path}?token=fake`);
vi.mock("@/lib/storage", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/storage")>();
  return { ...real, createSignedPdfUrl: (path: string) => signMock(path) };
});

const SEGREDO = Buffer.from("segredo-do-webhook-do-resend-teste");
// Antes de qualquer import dinâmico de lib/env (que lê process.env no carregamento).
process.env.RESEND_WEBHOOK_SECRET = `whsec_${SEGREDO.toString("base64")}`;

const PORT = 55616;
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
  // O limite por IP é em memória e todos os testes vêm do mesmo "IP": isola cada um.
  (await import("@/lib/rate-limit"))._resetRateLimitState();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

const TOKEN = "11111111-1111-4111-8111-111111111111";
const OUTRO = "22222222-2222-4222-8222-222222222222";

async function criar(opts: { token?: string; status?: string; emailStatus?: string | null; reenvios?: number; ultimoReenvioHa?: string | null; resendId?: string | null } = {}) {
  const { token = TOKEN, status = "pago", emailStatus = "enviado", reenvios = 0, ultimoReenvioHa = null, resendId = null } = opts;
  await sql`
    insert into pedidos (client_token, external_reference, area_slug, trilha, payer_email, amount, status, mp_order_id,
                         email_status, email_reenvios, email_ultimo_reenvio_em, resend_email_id)
    values (${token}, ${token + "-ref"}, 'financeiro', 'crescer', 'pagador@example.com', 29.90, ${status}, ${token + "-mp"},
            ${emailStatus}, ${reenvios},
            ${ultimoReenvioHa ? sql`now() - ${ultimoReenvioHa}::interval` : null}, ${resendId})
  `;
}
const pedido = async (token = TOKEN) => (await sql`select * from pedidos where client_token = ${token}`)[0] as Record<string, unknown>;

async function reenviar(token: string, headers: Record<string, string> = {}) {
  const { POST } = await import("@/app/api/orders/[id]/reenviar/route");
  const req = new NextRequest(`http://localhost/api/orders/${token}/reenviar`, { method: "POST", headers });
  const res = await POST(req, { params: Promise.resolve({ id: token }) });
  return { status: res.status, json: await res.json().catch(() => null), headers: res.headers };
}

describe("POST /api/orders/:id/reenviar", () => {
  it("pedido pago com e-mail enviado: enfileira de novo e conta o reenvio", async () => {
    await criar();
    const r = await reenviar(TOKEN);
    expect(r.status).toBe(202);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(await pedido()).toMatchObject({ email_status: "pendente", email_reenvios: 1, email_tentativas: 0 });
  });

  it("usa a chave de idempotência do reenvio e o payer_email já gravado", async () => {
    await criar();
    await reenviar(TOKEN, { "x-destinatario": "terceiro@example.com" });
    const { processEmailQueue } = await import("@/lib/email-queue");
    const enviados: { to: string; idempotencyKey: string }[] = [];
    await processEmailQueue({
      appUrl: "https://app.example.test",
      sender: async (m) => {
        enviados.push({ to: m.to, idempotencyKey: m.idempotencyKey });
        return { ok: true, id: "em_r1" };
      },
    });
    const p = await pedido();
    expect(enviados).toEqual([{ to: "pagador@example.com", idempotencyKey: `guia-reenvio/${p.id}/1` }]);
  });

  it("o destinatário nunca vem da requisição (corpo ignorado)", async () => {
    await criar();
    const { POST } = await import("@/app/api/orders/[id]/reenviar/route");
    const req = new NextRequest(`http://localhost/api/orders/${TOKEN}/reenviar`, {
      method: "POST",
      body: JSON.stringify({ to: "spam@example.com", email: "spam@example.com" }),
    });
    await POST(req, { params: Promise.resolve({ id: TOKEN }) });
    expect((await pedido()).payer_email).toBe("pagador@example.com");
  });

  it("intervalo mínimo de 2 minutos: devolve 429 com Retry-After", async () => {
    await criar({ reenvios: 1, ultimoReenvioHa: "30 seconds" });
    const r = await reenviar(TOKEN);
    expect(r.status).toBe(429);
    expect(Number(r.headers.get("retry-after"))).toBeGreaterThan(80);
    expect((await pedido()).email_reenvios).toBe(1);
  });

  it("depois do intervalo volta a aceitar; no máximo 3 reenvios por pedido", async () => {
    await criar({ reenvios: 2, ultimoReenvioHa: "5 minutes" });
    expect((await reenviar(TOKEN)).status).toBe(202);
    expect((await pedido()).email_reenvios).toBe(3);
    await sql`update pedidos set email_status = 'enviado', email_ultimo_reenvio_em = now() - interval '10 minutes'`;
    const r = await reenviar(TOKEN);
    expect(r.status).toBe(429);
    expect((await pedido()).email_reenvios).toBe(3);
  });

  it("dois cliques ao mesmo tempo: só um passa (UPDATE condicional único)", async () => {
    await criar();
    const rs = await Promise.all([reenviar(TOKEN), reenviar(TOKEN), reenviar(TOKEN)]);
    expect((await pedido()).email_reenvios).toBe(1);
    expect(rs.every((r) => r.status === 202)).toBe(true); // os demais caem em "já em andamento"
  });

  it("pedido não pago e token inexistente recebem a MESMA resposta", async () => {
    await criar({ status: "pendente", emailStatus: null });
    const naoPago = await reenviar(TOKEN);
    const inexistente = await reenviar(OUTRO);
    expect(naoPago.status).toBe(404);
    expect(inexistente.status).toBe(404);
    expect(naoPago.json).toEqual(inexistente.json);
    expect((await pedido()).email_status).toBeNull();
  });

  it("token malformado é 404 igual aos outros (zod), sem tocar no banco", async () => {
    const r = await reenviar("' or 1=1 --");
    expect(r.status).toBe(404);
  });

  it("e-mail rejeitado (bounce/reclamação): não reenvia, aponta para o download", async () => {
    await criar({ emailStatus: "rejeitado" });
    const r = await reenviar(TOKEN);
    expect(r.status).toBe(409);
    expect((await pedido()).email_status).toBe("rejeitado");
  });

  it("limite por IP em memória responde 429", async () => {
    await criar();
    const { _resetRateLimitState } = await import("@/lib/rate-limit");
    _resetRateLimitState();
    const codigos: number[] = [];
    for (let i = 0; i < 12; i += 1) codigos.push((await reenviar(OUTRO, { "x-forwarded-for": "9.9.9.9" })).status);
    expect(codigos).toContain(429);
    _resetRateLimitState();
  });
});

describe("GET /api/orders/:id/guia", () => {
  async function guia(token: string) {
    const { GET } = await import("@/app/api/orders/[id]/guia/route");
    const res = await GET(new NextRequest(`http://localhost/api/orders/${token}/guia`), { params: Promise.resolve({ id: token }) });
    return { status: res.status, headers: res.headers, json: await res.json().catch(() => null) };
  }

  it("pedido pago: 302 para a URL assinada na hora, sem cache e sem Referer", async () => {
    await criar();
    const r = await guia(TOKEN);
    expect(r.status).toBe(302);
    expect(r.headers.get("location")).toContain("Guia-Carreira-Financeiro-Crescer-na-Empresa.pdf");
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(r.headers.get("referrer-policy")).toBe("no-referrer");
    expect(signMock).toHaveBeenCalledTimes(1);
  });

  it("não pago e inexistente: mesma resposta 404, sem assinar nada", async () => {
    await criar({ status: "pendente", emailStatus: null });
    const a = await guia(TOKEN);
    const b = await guia(OUTRO);
    expect(a.status).toBe(404);
    expect(b.status).toBe(404);
    expect(a.json).toEqual(b.json);
    expect(signMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/webhooks/resend", () => {
  function assinar(id: string, ts: number, corpo: string) {
    return `v1,${createHmac("sha256", SEGREDO).update(`${id}.${ts}.${corpo}`).digest("base64")}`;
  }
  async function webhook(
    evento: Record<string, unknown>,
    opts: { id?: string; ts?: number; assinatura?: string | null; corpo?: string } = {}
  ) {
    const { POST } = await import("@/app/api/webhooks/resend/route");
    const corpo = opts.corpo ?? JSON.stringify(evento);
    const id = opts.id ?? `msg_${Math.random().toString(36).slice(2)}`;
    const ts = opts.ts ?? Math.floor(Date.now() / 1000);
    const headers: Record<string, string> = { "svix-id": id, "svix-timestamp": String(ts) };
    const assinatura = opts.assinatura === undefined ? assinar(id, ts, corpo) : opts.assinatura;
    if (assinatura !== null) headers["svix-signature"] = assinatura;
    const res = await POST(new NextRequest("http://localhost/api/webhooks/resend", { method: "POST", headers, body: corpo }));
    return { status: res.status, id };
  }
  const ev = (type: string, emailId = "em_w1", extra: Record<string, unknown> = {}) => ({ type, data: { email_id: emailId, ...extra } });

  it("assinatura inválida ou ausente: 400 e nada muda", async () => {
    await criar({ resendId: "em_w1" });
    expect((await webhook(ev("email.delivered"), { assinatura: "v1,AAAA" })).status).toBe(400);
    expect((await webhook(ev("email.delivered"), { assinatura: null })).status).toBe(400);
    expect((await pedido()).email_status).toBe("enviado");
    const n = await sql`select count(*)::int as n from pedido_webhook_eventos`;
    expect(n[0].n).toBe(0);
  });

  it("corpo adulterado depois de assinado: 400 (a assinatura cobre o texto bruto)", async () => {
    await criar({ resendId: "em_w1" });
    const id = "msg_fixo";
    const ts = Math.floor(Date.now() / 1000);
    const original = JSON.stringify(ev("email.delivered"));
    const r = await webhook(ev("email.delivered"), { id, ts, assinatura: assinar(id, ts, original), corpo: original.replace("em_w1", "em_w2") });
    expect(r.status).toBe(400);
  });

  it("timestamp velho (mais de 5 min): 400", async () => {
    await criar({ resendId: "em_w1" });
    const ts = Math.floor(Date.now() / 1000) - 10 * 60;
    expect((await webhook(ev("email.delivered"), { ts })).status).toBe(400);
    expect((await pedido()).email_status).toBe("enviado");
  });

  it("delivered: enviado -> entregue", async () => {
    await criar({ resendId: "em_w1" });
    expect((await webhook(ev("email.delivered"))).status).toBe(200);
    const p = await pedido();
    expect(p.email_status).toBe("entregue");
    expect(p.email_entregue_em).not.toBeNull();
  });

  it("evento duplicado (mesmo svix-id) é processado uma vez só", async () => {
    await criar({ resendId: "em_w1" });
    const a = await webhook(ev("email.delivered"), { id: "msg_dup" });
    const b = await webhook(ev("email.delivered"), { id: "msg_dup" });
    expect([a.status, b.status]).toEqual([200, 200]);
    const n = await sql`select count(*)::int as n from pedido_webhook_eventos where event_key = 'resend:msg_dup'`;
    expect(n[0].n).toBe(1);
  });

  it("fora de ordem: delivered depois de rejeitado não regride o estado", async () => {
    await criar({ resendId: "em_w1" });
    await webhook(ev("email.bounced", "em_w1", { bounce: { type: "Permanent" } }));
    expect((await pedido()).email_status).toBe("rejeitado");
    expect((await webhook(ev("email.delivered"))).status).toBe(200);
    expect((await pedido()).email_status).toBe("rejeitado");
  });

  it("bounce definitivo e reclamação marcam rejeitado e param o retry", async () => {
    await criar({ resendId: "em_w1" });
    await webhook(ev("email.complained"));
    expect(await pedido()).toMatchObject({ email_status: "rejeitado" });
    const { claimNextEmail } = await import("@/lib/email-queue");
    expect(await claimNextEmail()).toBeUndefined();
  });

  it("complaint depois de entregue também rejeita", async () => {
    await criar({ emailStatus: "entregue", resendId: "em_w1" });
    await webhook(ev("email.complained"));
    expect((await pedido()).email_status).toBe("rejeitado");
  });

  it("bounce temporário não encerra o fluxo", async () => {
    await criar({ resendId: "em_w1" });
    expect((await webhook(ev("email.bounced", "em_w1", { bounce: { type: "Transient" } }))).status).toBe(200);
    expect((await pedido()).email_status).toBe("enviado");
  });

  it("email_id desconhecido: responde não-2xx (o Svix reentrega) e NÃO consome o evento", async () => {
    const r = await webhook(ev("email.delivered", "em_ainda_nao_gravado"), { id: "msg_cedo" });
    expect(r.status).toBe(404);
    const n = await sql`select count(*)::int as n from pedido_webhook_eventos`;
    expect(n[0].n).toBe(0);
    // Depois que o envio grava o id, a MESMA entrega (mesmo svix-id) é aceita.
    await criar({ resendId: "em_ainda_nao_gravado" });
    expect((await webhook(ev("email.delivered", "em_ainda_nao_gravado"), { id: "msg_cedo" })).status).toBe(200);
    expect((await pedido()).email_status).toBe("entregue");
  });

  it("tipos que não mudam estado são reconhecidos e descartados", async () => {
    await criar({ resendId: "em_w1" });
    expect((await webhook(ev("email.opened"))).status).toBe(200);
    expect((await webhook(ev("email.delivery_delayed"))).status).toBe(200);
    expect((await pedido()).email_status).toBe("enviado");
  });

  it("corpo acima do limite: 413", async () => {
    const grande = JSON.stringify({ type: "email.delivered", data: { email_id: "x".repeat(70 * 1024) } });
    expect((await webhook({}, { corpo: grande })).status).toBe(413);
  });

  it("não aceita GET", async () => {
    const mod = await import("@/app/api/webhooks/resend/route");
    expect((mod as Record<string, unknown>).GET).toBeUndefined();
  });
});
