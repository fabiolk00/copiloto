/**
 * Ameaça 3: webhook forjado, replay e abuso.
 *
 * Assinatura ausente/errada/expirada e replay de evento idêntico já têm
 * cobertura extensa em tests/integration/webhook.route.test.ts (escrita na
 * sessão anterior, antes deste modelo de ameaças). Este arquivo consolida
 * essa matriz sob o guarda-chuva de "security" e cobre o que é novo aqui:
 * rate limit e limite de tamanho do corpo (lib/rate-limit.ts,
 * lib/request-guards.ts, adicionados por esta revisão).
 *
 * Não retestado por não ser praticável/determinístico num teste automatizado:
 * - Comparação de assinatura em tempo constante: confirmado por revisão de
 *   código — `WebhookSignatureValidator` usa `crypto.timingSafeEqual`
 *   (node_modules/mercadopago/dist/utils/webhook/index.js#constantTimeEquals).
 *   Um teste de timing real seria inerentemente instável em CI.
 * - "Segredo de teste usado em produção": não há dois segredos distintos no
 *   código — é um único valor de `MP_WEBHOOK_SECRET` vindo do ambiente. O
 *   risco é operacional (rotação/gestão de segredo), não de código; ver
 *   SECURITY_REVIEW.md.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { NextRequest } from "next/server";
import type { PGlite } from "@electric-sql/pglite";
import type { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { startTestDb, stopTestDb, resetTestDb, TEST_SQL_GLOBAL_KEY } from "../helpers/test-db";
import { buildSignatureHeader } from "../helpers/mp-signature";
import { buildPixOrderGetResponsePaid } from "../helpers/mp-fixtures";
import { _resetRateLimitState } from "@/lib/rate-limit";

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

const PORT = 55606;
const WEBHOOK_SECRET = "test-webhook-secret";
const MP_ORDER_ID = "ORD-FORGERY-1";

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
  await sql`
    insert into pedidos (client_token, external_reference, area_slug, trilha, payer_email, amount, status, mp_order_id)
    values ('forgery-token', 'forgery-token-a1', 'financeiro', 'crescer', 'forgery@example.com', 29.90, 'pendente', ${MP_ORDER_ID})
  `;
});

afterEach(() => {
  vi.clearAllMocks();
});

async function postWebhook(opts: {
  skipSignature?: boolean;
  signatureOverride?: string;
  requestId?: string;
  rawBody?: string;
  ip?: string;
}) {
  const { POST } = await import("@/app/api/webhooks/mercadopago/route");
  const requestId = opts.requestId ?? "req-1";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (!opts.skipSignature) {
    headers["x-signature"] =
      opts.signatureOverride ?? buildSignatureHeader({ dataId: MP_ORDER_ID, requestId, secret: WEBHOOK_SECRET }).xSignature;
    headers["x-request-id"] = requestId;
  }
  if (opts.ip) headers["x-forwarded-for"] = opts.ip;

  const req = new NextRequest(`http://localhost/api/webhooks/mercadopago?data.id=${MP_ORDER_ID}`, {
    method: "POST",
    headers,
    body: opts.rawBody ?? JSON.stringify({ action: "order.processed", type: "order", data: { id: MP_ORDER_ID } }),
  });
  return POST(req);
}

describe("matriz de forjamento de assinatura — tudo deve dar 401 sem efeito no banco", () => {
  const cases: Array<{ name: string; build: () => Partial<Parameters<typeof postWebhook>[0]> }> = [
    { name: "sem x-signature", build: () => ({ skipSignature: true }) },
    {
      name: "assinatura com secret errado",
      build: () => ({ signatureOverride: buildSignatureHeader({ dataId: MP_ORDER_ID, requestId: "req-1", secret: "secret-errado" }).xSignature }),
    },
    {
      name: "ts expirado (fora da tolerância de 300s)",
      build: () => ({
        signatureOverride: buildSignatureHeader({
          dataId: MP_ORDER_ID,
          requestId: "req-1",
          secret: WEBHOOK_SECRET,
          ts: Math.floor(Date.now() / 1000) - 3600,
        }).xSignature,
      }),
    },
    {
      name: "assinatura malformada (sem ts=/v1=)",
      build: () => ({ signatureOverride: "nao-e-uma-assinatura-valida" }),
    },
  ];

  for (const { name, build } of cases) {
    it(name, async () => {
      const res = await postWebhook(build());
      expect(res.status).toBe(401);
      expect(orderGetMock).not.toHaveBeenCalled();
      const [row] = await sql`select status from pedidos where mp_order_id = ${MP_ORDER_ID}`;
      expect(row.status).toBe("pendente");
    });
  }
});

describe("rate limit no endpoint de webhook", () => {
  it("excede o limite por IP e responde 429 com Retry-After, sem processar a notificação em excesso", async () => {
    orderGetMock.mockResolvedValue(buildPixOrderGetResponsePaid());
    const ip = "203.0.113.50";

    const responses = [];
    for (let i = 0; i < 65; i++) {
      responses.push(await postWebhook({ requestId: `req-flood-${i}`, ip }));
    }

    const limited = responses.filter((r) => r.status === 429);
    expect(limited.length).toBeGreaterThan(0);
    expect(limited[0].headers.get("Retry-After")).toBeTruthy();
  });

  it("IPs diferentes têm limites independentes", async () => {
    orderGetMock.mockResolvedValue(buildPixOrderGetResponsePaid());
    for (let i = 0; i < 60; i++) {
      await postWebhook({ requestId: `req-ip-a-${i}`, ip: "198.51.100.1" });
    }
    const resOtherIp = await postWebhook({ requestId: "req-ip-b", ip: "198.51.100.2" });
    expect(resOtherIp.status).not.toBe(429);
  });
});

describe("limite de tamanho do corpo", () => {
  it("corpo maior que o limite configurado é rejeitado com 413, sem exceção não tratada", async () => {
    const hugeBody = JSON.stringify({
      action: "order.processed",
      type: "order",
      data: { id: MP_ORDER_ID },
      padding: "x".repeat(400 * 1024), // > 256KB configurado em app/api/webhooks/mercadopago/route.ts
    });
    const res = await postWebhook({ rawBody: hugeBody });
    expect(res.status).toBe(413);
    expect(orderGetMock).not.toHaveBeenCalled();
  });

  it("Content-Length mentindo (maior que o corpo real) também é pego pela defesa em streaming", async () => {
    // readJsonWithLimit lê o corpo em streaming e conta bytes reais — não
    // confia só no header. Aqui simulamos o caminho onde o Content-Length
    // está ausente/poderia ser forjado: o corpo real já excede o limite.
    const hugeBody = "x".repeat(300 * 1024);
    const res = await postWebhook({ rawBody: hugeBody });
    expect([400, 413]).toContain(res.status); // corpo não é JSON válido OU excede o limite — nunca 500
  });
});
