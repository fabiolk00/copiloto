import {
  test,
  expect,
  goToCheckoutPage,
  startCheckout,
  fillEmailAndSubmit,
  getClientToken,
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

    const errorAlert = page.getByRole("alert");
    await expect(errorAlert).toBeVisible({ timeout: 10_000 });
    await expect(errorAlert).toContainText(/não foi possível gerar o pix/i);
    await expect(page.getByRole("button", { name: /tentar de novo/i })).toBeVisible();

    const clientToken = await getClientToken(page);
    expect(await db.countPedidosByClientToken(clientToken)).toBe(0);

    // A Mercado Pago volta a funcionar — "Tentar de novo" deve completar o fluxo normalmente.
    await fakeMp.setChaos({ mode: "off" });
    await page.getByRole("button", { name: /tentar de novo/i }).click();
    await expect(page.getByAltText(/qr code pix/i)).toBeVisible({ timeout: 15_000 });
    expect(await db.countPedidosByClientToken(clientToken)).toBe(1);
  });
});
