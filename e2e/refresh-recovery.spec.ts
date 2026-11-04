import { test, expect, generatePixViaUi, getClientToken, uniqueEmail } from "./fixtures";

test("refresh durante o pagamento: o Pix atual é recuperado, não gera outro", async ({ page, db, fakeMp }) => {
  await generatePixViaUi(page, uniqueEmail("refresh-recovery"));

  const clientToken = await getClientToken(page);
  const beforeReload = await db.waitForPedido(clientToken);
  const qrCodeBeforeReload = await page.getByLabel(/pix copia e cola/i).inputValue();

  await page.reload();

  // Sem reload automático para o estado "idle": a sessão persistida (ver
  // PixCheckout.tsx, sessionStorage) refaz a chamada de criação, que o
  // servidor reconhece como replay do pedido pendente — não um pedido novo.
  await expect(page.getByAltText(/qr code pix/i)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByLabel(/pix copia e cola/i)).toHaveValue(qrCodeBeforeReload);

  const afterReload = await db.getByClientToken(clientToken);
  expect(afterReload?.mp_order_id).toBe(beforeReload.mp_order_id);
  expect(afterReload?.attempt).toBe(1);
  expect(await db.countPedidosByClientToken(clientToken)).toBe(1);

  // Confirma que a sessão recuperada ainda funciona de ponta a ponta.
  await fakeMp.pay(beforeReload.mp_order_id!);
  await expect(page).toHaveURL(/\/obrigado\?area=/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/seu guia está a caminho/i);
});
