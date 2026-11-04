import crypto from "node:crypto";
import {
  test,
  expect,
  goToCheckoutPage,
  startCheckout,
  seedSessionStorage,
  uniqueEmail,
  USER_A_EMAIL,
} from "./fixtures";

test.describe("duplo clique e duas abas: nenhuma order duplicada para o mesmo pedido", () => {
  test("duplo clique rápido no botão de gerar Pix dispara só uma criação de order", async ({ page, db }) => {
    await goToCheckoutPage(page);
    await startCheckout(page);
    await page.getByLabel(/seu e-mail/i).fill(uniqueEmail("double-click"));

    const createRequests: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/api/pix/create") && req.method() === "POST") createRequests.push(req.url());
    });

    const submitButton = page.getByRole("button", { name: /gerar código pix/i });
    // Duplo clique de verdade: assim que o primeiro clique dispara, o componente
    // troca para "Gerando o Pix…" e o botão some (primeira linha de defesa contra o
    // duplo clique) — o 2º clique pode não achar mais o elemento, o que é esperado.
    await submitButton.dblclick({ timeout: 5_000 }).catch(() => {});

    await expect(page.getByAltText(/qr code pix/i)).toBeVisible({ timeout: 15_000 });
    expect(createRequests.length).toBeLessThanOrEqual(2); // o 2º clique, se chegou a disparar, não gerou 2 orders (ver asserção de banco abaixo)

    const clientToken = (await page.evaluate(() => sessionStorage.getItem("pix-checkout-session")))!;
    const token = (JSON.parse(clientToken) as { clientToken: string }).clientToken;
    expect(await db.countPedidosByClientToken(token)).toBe(1);
  });

  test("duas abas com o mesmo pedido (mesmo clientToken) competindo: só uma order fica persistida, sem duplicar nem travar", async ({
    browser,
    db,
  }) => {
    const sharedClientToken = crypto.randomUUID();
    const context = await browser.newContext();
    const pageA = await context.newPage();
    const pageB = await context.newPage();

    // Simula duas abas que, por algum motivo (link compartilhado, aba
    // duplicada), carregam a mesma sessão de Pix — não é o comportamento
    // espontâneo de hoje (cada aba nova gera seu próprio clientToken), mas é
    // exatamente o cenário de risco que "duas abas, mesmo pedido" descreve:
    // duas requisições concorrentes de criação de order para o mesmo pedido.
    await seedSessionStorage(pageA, sharedClientToken, USER_A_EMAIL);
    await seedSessionStorage(pageB, sharedClientToken, USER_A_EMAIL);

    async function waitForOutcome(page: typeof pageA) {
      await Promise.race([
        page.getByAltText(/qr code pix/i).waitFor({ state: "visible", timeout: 15_000 }),
        page.getByRole("alert").waitFor({ state: "visible", timeout: 15_000 }),
      ]).catch(() => {
        // nenhum dos dois apareceu no prazo — tratado como falha abaixo pela asserção qrOnA||qrOnB.
      });
    }

    await Promise.all([pageA.goto("/financeiro?trilha=crescer"), pageB.goto("/financeiro?trilha=crescer")]);
    await Promise.all([waitForOutcome(pageA), waitForOutcome(pageB)]);

    // Uma das duas abas deve acabar mostrando o QR (a vencedora da corrida);
    // a outra pode cair num erro recuperável, mas nunca travar nem duplicar.
    const qrOnA = await pageA.getByAltText(/qr code pix/i).isVisible().catch(() => false);
    const qrOnB = await pageB.getByAltText(/qr code pix/i).isVisible().catch(() => false);
    expect(qrOnA || qrOnB).toBe(true);

    const rows = await db.getByClientToken(sharedClientToken);
    expect(rows).toBeTruthy();
    expect(await db.countPedidosByClientToken(sharedClientToken)).toBe(1);
    expect(rows?.mp_order_id).toBeTruthy();
    expect(rows?.attempt).toBe(1);

    await context.close();
  });
});
