import { test, expect, generatePixViaUi, getClientToken, uniqueEmail } from "./fixtures";

/**
 * Determinismo: o harness sobe o app com MP_PIX_EXPIRATION=PT25S (ver
 * harness/run.mjs) em vez dos 30min default, então a expiração é uma
 * espera real, curta e limitada — não um `waitForTimeout` arbitrário — e a
 * asserção abaixo espera por uma condição (texto "expirou"), não por um
 * tempo fixo. 25s dá folga suficiente para os outros cenários (que pagam o
 * Pix e esperam a confirmação) terminarem bem antes da janela expirar,
 * evitando a complexidade de mockar o relógio do navegador enquanto o
 * polling (outro timer independente) continua rodando.
 */
test("expiração: Pix expira, UI oferece gerar novo, o novo Pix cria uma nova order", async ({ page, db }) => {
  await generatePixViaUi(page, uniqueEmail("expiration"));

  const clientToken = await getClientToken(page);
  const firstPedido = await db.waitForPedido(clientToken);

  await expect(page.getByText(/esse pix expirou/i)).toBeVisible({ timeout: 30_000 });

  await page.getByRole("button", { name: /gerar novo pix/i }).click();
  await expect(page.getByAltText(/qr code pix/i)).toBeVisible({ timeout: 15_000 });

  const secondPedido = await db.getByClientToken(clientToken);
  expect(secondPedido?.attempt).toBe(2);
  expect(secondPedido?.mp_order_id).not.toBe(firstPedido.mp_order_id);
  expect(await db.countPedidosByClientToken(clientToken)).toBe(1); // mesma linha, não duplicada
});
