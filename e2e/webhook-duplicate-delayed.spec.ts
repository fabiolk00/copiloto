import { test, expect, generatePixViaUi, getClientToken, uniqueEmail } from "./fixtures";

test("webhook duplicado e atrasado: estado final correto, efeito colateral uma vez só", async ({ page, db, fakeMp }) => {
  await generatePixViaUi(page, uniqueEmail("webhook-dup-delayed"));

  const clientToken = await getClientToken(page);
  const pedido = await db.waitForPedido(clientToken);

  // Mesma notificação (mesmo action/assinatura) entregue 2x, 1.5s atrasada —
  // simula atraso de rede + reentrega da Mercado Pago na mesma tacada.
  await fakeMp.pay(pedido.mp_order_id!, { delayMs: 1_500, duplicateCount: 2 });

  await expect(page).toHaveURL(/\/obrigado\?area=/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/seu guia está a caminho/i);

  const updated = await db.getByClientToken(clientToken);
  expect(updated?.status).toBe("pago");

  // Efeito colateral (a transição de status) só aconteceu uma vez: o dedup
  // de evento (pedido_webhook_eventos, chave type:data.id:action) guarda uma
  // única linha mesmo com a notificação duplicada.
  const [{ count }] = await db.sql<{ count: string }[]>`
    select count(*)::int as count from pedido_webhook_eventos where data_id = ${pedido.mp_order_id!}
  `;
  expect(Number(count)).toBe(1);
});
