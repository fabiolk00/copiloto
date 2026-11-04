import { test as base, expect, type Page } from "@playwright/test";
import postgres from "postgres";

const DATABASE_URL = process.env.HARNESS_DATABASE_URL;
const FAKE_MP_CONTROL_URL = process.env.FAKE_MP_CONTROL_URL;

if (!DATABASE_URL) throw new Error("HARNESS_DATABASE_URL não definida — rode via `npm run harness`.");
if (!FAKE_MP_CONTROL_URL) throw new Error("FAKE_MP_CONTROL_URL não definida — rode via `npm run harness`.");

/**
 * Não há tabela de usuários neste app (ver harness/db.mjs) — os "usuários A
 * e B" do harness são só dois e-mails de pagador fixos, usados pelos
 * cenários que precisam de duas identidades distintas.
 */
export const USER_A_EMAIL = "usuario.a@harness.test";
export const USER_B_EMAIL = "usuario.b@harness.test";

export type PedidoRow = {
  id: number;
  client_token: string;
  external_reference: string;
  payer_email: string;
  amount: string;
  status: string;
  attempt: number;
  mp_order_id: string | null;
  qr_code: string | null;
  expires_at: string | null;
};

class DbHelper {
  readonly sql = postgres(DATABASE_URL!, { prepare: false, max: 3 });

  async getByClientToken(clientToken: string): Promise<PedidoRow | undefined> {
    const [row] = await this.sql<PedidoRow[]>`select * from pedidos where client_token = ${clientToken}`;
    return row;
  }

  /** Espera a order ser persistida pelo app depois do clique de "gerar Pix" (POST /api/pix/create ainda em voo). */
  async waitForPedido(clientToken: string, timeoutMs = 15_000): Promise<PedidoRow> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const row = await this.getByClientToken(clientToken);
      if (row?.mp_order_id) return row;
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error(`Pedido para clientToken=${clientToken} não apareceu no banco em ${timeoutMs}ms`);
  }

  async countPedidosByClientToken(clientToken: string): Promise<number> {
    const rows = await this.sql`select id from pedidos where client_token = ${clientToken}`;
    return rows.length;
  }

  async backdateExpiry(clientToken: string): Promise<void> {
    await this.sql`update pedidos set expires_at = now() - interval '1 second' where client_token = ${clientToken}`;
  }

  async close(): Promise<void> {
    await this.sql.end({ timeout: 1 });
  }
}

class FakeMpHelper {
  private async post(path: string, body: unknown = {}) {
    const res = await fetch(`${FAKE_MP_CONTROL_URL}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`fake-mp control ${path} -> ${res.status}`);
    return res.json();
  }

  pay(mpOrderId: string, opts: { delayMs?: number; duplicateCount?: number } = {}) {
    return this.post(`/__control__/orders/${mpOrderId}/pay`, opts);
  }

  expire(mpOrderId: string, opts: { delayMs?: number } = {}) {
    return this.post(`/__control__/orders/${mpOrderId}/expire`, opts);
  }

  fail(mpOrderId: string, opts: { delayMs?: number } = {}) {
    return this.post(`/__control__/orders/${mpOrderId}/fail`, opts);
  }

  setChaos(opts: { mode: "off" | "500" | "timeout"; scope?: "create" | "get" | "both" }) {
    return this.post(`/__control__/chaos`, opts);
  }

  async getOrder(mpOrderId: string) {
    const res = await fetch(`${FAKE_MP_CONTROL_URL}/__control__/orders/${mpOrderId}`);
    if (!res.ok) throw new Error(`fake-mp GET order ${mpOrderId} -> ${res.status}`);
    return res.json();
  }
}

export const test = base.extend<{ db: DbHelper; fakeMp: FakeMpHelper }>({
  db: async ({}, use) => {
    const helper = new DbHelper();
    await use(helper);
    await helper.close();
  },
  fakeMp: async ({}, use) => {
    await use(new FakeMpHelper());
  },
});

export { expect };

/** Gera um e-mail único por teste, para nunca colidir com um pedido de outro teste/execução anterior. */
export function uniqueEmail(label: string): string {
  return `${label}.${Date.now()}.${Math.floor(Math.random() * 1e6)}@harness.test`;
}

const AREA_SLUG = "financeiro";
const AREA_NAME = "Financeiro";

export async function goToCheckoutPage(page: Page) {
  // O checkout só libera o botão com uma trilha escolhida (ver PixCheckout.tsx).
  await page.goto(`/${AREA_SLUG}?trilha=crescer`);
}

export async function startCheckout(page: Page) {
  await page.getByRole("button", { name: new RegExp(`quero o guia de ${AREA_NAME}`, "i") }).click();
}

export async function fillEmailAndSubmit(page: Page, email: string) {
  await page.getByLabel(/seu e-mail/i).fill(email);
  await page.getByRole("button", { name: /gerar código pix/i }).click();
}

/** Fluxo completo: abre a página, inicia o checkout, preenche e-mail, espera o QR aparecer. */
export async function generatePixViaUi(page: Page, email: string) {
  await goToCheckoutPage(page);
  await startCheckout(page);
  await fillEmailAndSubmit(page, email);
  await expect(page.getByAltText(/qr code pix/i)).toBeVisible({ timeout: 15_000 });
}

/** Lê o clientToken persistido pelo próprio componente (ver PixCheckout.tsx, SESSION_STORAGE_KEY). */
export async function getClientToken(page: Page): Promise<string> {
  const raw = await page.evaluate(() => sessionStorage.getItem("pix-checkout-session"));
  if (!raw) throw new Error("sessionStorage sem sessão de Pix — o checkout foi iniciado?");
  return (JSON.parse(raw) as { clientToken: string }).clientToken;
}

export async function seedSessionStorage(page: Page, clientToken: string, email: string) {
  await page.addInitScript(
    ([key, value]) => {
      window.sessionStorage.setItem(key, value);
    },
    ["pix-checkout-session", JSON.stringify({ clientToken, email })] as const
  );
}
