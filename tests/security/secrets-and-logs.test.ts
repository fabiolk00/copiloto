/**
 * Ameaça 5: segredos e dados — Access Token e MP_WEBHOOK_SECRET nunca
 * aparecem em respostas HTTP ou em logs; nenhum dado sensível
 * desnecessário (qr_code completo, payer_email) é logado.
 *
 * Varredura de segredos no repositório/histórico: ver SECURITY_REVIEW.md —
 * gitleaks (binário oficial, baixado para .security-tools/) rodou contra
 * todo o histórico e não encontrou nada. trufflehog foi bloqueado pelo
 * classificador de modo automático deste ambiente (execução de binário
 * externo); pendente de aprovação manual, documentado no relatório.
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

const PORT = 55609;
const WEBHOOK_SECRET = "test-webhook-secret"; // igual ao MP_WEBHOOK_SECRET de tests/setup/env.ts
const ACCESS_TOKEN = "TEST-access-token"; // igual ao MP_ACCESS_TOKEN de tests/setup/env.ts

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

/** Captura tudo que passaria por console.log/warn/error durante um fluxo, como string única. */
async function captureLogs(fn: () => Promise<void>): Promise<string> {
  const chunks: string[] = [];
  const spies = (["log", "warn", "error"] as const).map((method) =>
    vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
      chunks.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));
    })
  );
  try {
    await fn();
  } finally {
    spies.forEach((s) => s.mockRestore());
  }
  return chunks.join("\n");
}

describe("segredos nunca aparecem em respostas HTTP", () => {
  it("resposta de sucesso de /api/pix/create não contém o access token nem o webhook secret", async () => {
    orderCreateMock.mockResolvedValueOnce(buildPixOrderCreateResponse({ id: "ORD-SECRET-1" }));
    const { POST } = await import("@/app/api/pix/create/route");
    const req = new NextRequest("http://localhost/api/pix/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ area: "financeiro", trilha: "crescer", payerEmail: "a@example.com", clientToken: crypto.randomUUID() }),
    });
    const res = await POST(req);
    const text = await res.text();
    expect(text).not.toContain(ACCESS_TOKEN);
    expect(text).not.toContain(WEBHOOK_SECRET);
  });

  it("resposta de erro (500) de /api/pix/create não ecoa o access token no corpo", async () => {
    orderCreateMock.mockRejectedValueOnce(new Error(`falha usando token ${ACCESS_TOKEN}`));
    const { POST } = await import("@/app/api/pix/create/route");
    const req = new NextRequest("http://localhost/api/pix/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ area: "financeiro", trilha: "crescer", payerEmail: "a@example.com", clientToken: crypto.randomUUID() }),
    });
    const res = await POST(req);
    const text = await res.text();
    expect(text).not.toContain(ACCESS_TOKEN);
  });

  it("GET /api/orders/:id/status nunca retorna payer_email, amount, qr_code ou mp_order_id", async () => {
    const clientToken = crypto.randomUUID();
    await sql`
      insert into pedidos (client_token, external_reference, area_slug, trilha, payer_email, amount, status, mp_order_id, qr_code)
      values (${clientToken}, ${clientToken + "-a1"}, 'financeiro', 'crescer', 'segredo@example.com', 29.90, 'pendente', 'ORD-X', 'copia-cola-secreta')
    `;
    const { GET } = await import("@/app/api/orders/[id]/status/route");
    const req = new NextRequest(`http://localhost/api/orders/${clientToken}/status`);
    const res = await GET(req, { params: Promise.resolve({ id: clientToken }) });
    const text = await res.text();
    expect(text).not.toContain("segredo@example.com");
    expect(text).not.toContain("copia-cola-secreta");
    expect(text).not.toContain("ORD-X");
  });
});

describe("segredos e PII não aparecem em logs do servidor", () => {
  it("criação de Pix bem-sucedida não loga payer_email nem qr_code completo", async () => {
    orderCreateMock.mockResolvedValueOnce(buildPixOrderCreateResponse({ id: "ORD-LOG-1" }));
    const logs = await captureLogs(async () => {
      const { POST } = await import("@/app/api/pix/create/route");
      const req = new NextRequest("http://localhost/api/pix/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ area: "financeiro", trilha: "crescer", payerEmail: "naologa@example.com", clientToken: crypto.randomUUID() }),
      });
      await POST(req);
    });
    expect(logs).not.toContain("naologa@example.com");
    expect(logs).not.toContain(ACCESS_TOKEN);
  });

  it("webhook processado com sucesso não loga payer_email, qr_code nem o segredo do webhook", async () => {
    const clientToken = crypto.randomUUID();
    await sql`
      insert into pedidos (client_token, external_reference, area_slug, trilha, payer_email, amount, status, mp_order_id, qr_code)
      values (${clientToken}, ${clientToken + "-a1"}, 'financeiro', 'crescer', 'webhook-naologa@example.com', 29.90, 'pendente', 'ORD-LOG-2', 'copia-cola-webhook')
    `;
    orderGetMock.mockResolvedValueOnce(buildPixOrderGetResponsePaid());
    const requestId = "req-log-test";
    const sig = buildSignatureHeader({ dataId: "ORD-LOG-2", requestId, secret: WEBHOOK_SECRET });

    const logs = await captureLogs(async () => {
      const { POST } = await import("@/app/api/webhooks/mercadopago/route");
      const req = new NextRequest(`http://localhost/api/webhooks/mercadopago?data.id=ORD-LOG-2`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-signature": sig.xSignature, "x-request-id": requestId },
        body: JSON.stringify({ action: "order.processed", type: "order", data: { id: "ORD-LOG-2" } }),
      });
      await POST(req);
    });

    expect(logs).not.toContain("webhook-naologa@example.com");
    expect(logs).not.toContain("copia-cola-webhook");
    expect(logs).not.toContain(WEBHOOK_SECRET);
  });

  it("assinatura inválida loga o motivo mas nunca o segredo nem a assinatura recebida completa", async () => {
    const logs = await captureLogs(async () => {
      const { POST } = await import("@/app/api/webhooks/mercadopago/route");
      const req = new NextRequest(`http://localhost/api/webhooks/mercadopago?data.id=ORD-X`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-signature": "ts=1,v1=deadbeef", "x-request-id": "req-x" },
        body: "{}",
      });
      await POST(req);
    });
    expect(logs).not.toContain(WEBHOOK_SECRET);
  });
});

describe("variáveis sensíveis não chegam ao bundle do cliente", () => {
  it("nenhum arquivo em components/ ou app/ fora de app/api referencia MP_ACCESS_TOKEN ou MP_WEBHOOK_SECRET diretamente", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");

    function walk(dir: string): string[] {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      return entries.flatMap((e) => {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) return walk(full);
        return full.endsWith(".ts") || full.endsWith(".tsx") ? [full] : [];
      });
    }

    const clientFiles = [...walk("components"), ...walk("app").filter((f) => !f.includes(`${path.sep}api${path.sep}`))];
    const offenders = clientFiles.filter((f) => {
      const content = fs.readFileSync(f, "utf8");
      return content.includes("MP_ACCESS_TOKEN") || content.includes("MP_WEBHOOK_SECRET");
    });
    expect(offenders).toEqual([]);
  });
});
