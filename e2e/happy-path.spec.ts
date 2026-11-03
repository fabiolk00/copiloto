import { test, expect, generatePixViaUi, getClientToken, uniqueEmail } from "./fixtures";

test("fluxo feliz: comprar, ver QR, pagar via fake, UI muda para pago sem recarregar, pedido pago no banco", async ({
  page,
  db,
  fakeMp,
}) => {
  await generatePixViaUi(page, uniqueEmail("happy-path"));

  const clientToken = await getClientToken(page);
  const pedido = await db.waitForPedido(clientToken);
  expect(pedido.status).toBe("pendente");

  await expect(page.getByLabel(/pix copia e cola/i)).toHaveValue(pedido.qr_code ?? "");

  await fakeMp.pay(pedido.mp_order_id!);

  // A UI só descobre o pagamento pelo próprio polling (não há websocket/SSE) —
  // nenhum page.reload() aqui, é exatamente o que o cenário pede.
  await expect(page.getByRole("status")).toContainText(/pagamento aprovado/i, { timeout: 20_000 });

  const updated = await db.getByClientToken(clientToken);
  expect(updated?.status).toBe("pago");
});
