import {
  test,
  expect,
  goToCheckoutPage,
  startCheckout,
  fillEmailAndSubmit,
  uniqueEmail,
} from "./fixtures";

test.describe("queda da Mercado Pago", () => {
  test.afterEach(async ({ fakeMp }) => {
    await fakeMp.setChaos({ mode: "off" });
  });

  test("fake devolve 500: UI mostra erro recuperável e nenhum pedido fica preso no banco", async ({
    page,
    db,
    fakeMp,
  }) => {
    await fakeMp.setChaos({ mode: "500", scope: "both" });

    await goToCheckoutPage(page);
    await startCheckout(page);
    const email = uniqueEmail("mp-outage");
    await fillEmailAndSubmit(page, email);

    // O Next também injeta um role="alert" (route announcer) — filtra pelo erro do checkout.
    const errorAlert = page.getByRole("alert").filter({ hasText: /não foi possível gerar o pix/i });
    await expect(errorAlert).toBeVisible({ timeout: 10_000 });
    await expect(errorAlert).toContainText(/não foi possível gerar o pix/i);
    await expect(page.getByRole("button", { name: /tentar de novo/i })).toBeVisible();

    // A sessão só é persistida após sucesso, então o pedido é identificado pelo e-mail do pagador.
    const countByEmail = async () => {
      const [row] = await db.sql<{ n: number }[]>`select count(*)::int as n from pedidos where payer_email = ${email}`;
      return row.n;
    };
    expect(await countByEmail()).toBe(0);

    // A Mercado Pago volta a funcionar — "Tentar de novo" deve completar o fluxo normalmente.
    await fakeMp.setChaos({ mode: "off" });
    await page.getByRole("button", { name: /tentar de novo/i }).click();
    await expect(page.getByAltText(/qr code pix/i)).toBeVisible({ timeout: 15_000 });
    expect(await countByEmail()).toBe(1);
  });
});
