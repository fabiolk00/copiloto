import http from "node:http";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import { signWebhook } from "./signature.mjs";

/**
 * Fake da Orders API da Mercado Pago para o harness E2E.
 *
 * Implementa só a fatia que o app usa para Pix: criar order, consultar
 * order, e um stub de "process" (não usado em processing_mode automatic,
 * incluído por completude). Além disso expõe endpoints de controle
 * (`/__control__/...`) que um teste Playwright usa para pilotar o estado de
 * uma order e disparar webhooks para o app sob teste — com assinatura HMAC
 * real, igual à que o `WebhookSignatureValidator` do SDK recomputa.
 *
 * Nunca fala com a Mercado Pago real nem com nenhuma rede fora de localhost.
 */

const PORT = Number(process.env.FAKE_MP_PORT ?? 4010);
const WEBHOOK_SECRET = process.env.MP_WEBHOOK_SECRET;
const APP_WEBHOOK_URL = process.env.APP_WEBHOOK_URL;

if (!WEBHOOK_SECRET) throw new Error("FAKE MP: MP_WEBHOOK_SECRET é obrigatório");
if (!APP_WEBHOOK_URL) throw new Error("FAKE MP: APP_WEBHOOK_URL é obrigatório");

/** @type {Map<string, any>} */
const orders = new Map();
/** @type {Map<string, string>} chave de idempotência -> order id, para replay de verdade como a API real faz */
const idempotencyIndex = new Map();
let nextOrderSeq = 1;
let chaos = { mode: "off", scope: "both" }; // mode: off|500|timeout

function buildOrderPaymentMethod(order) {
  return {
    id: "pix",
    type: "bank_transfer",
    qr_code: `00020126580014br.gov.bcb.pix-fake-${order.id}`,
    qr_code_base64: Buffer.from(`fake-qr-${order.id}`).toString("base64"),
    ticket_url: `http://127.0.0.1:${PORT}/fake-ticket/${order.id}`,
  };
}

function serializeOrder(order) {
  return {
    id: order.id,
    type: "online",
    external_reference: order.externalReference,
    status: order.status,
    status_detail: order.statusDetail,
    total_amount: order.totalAmount,
    transactions: {
      payments: [
        {
          id: `${order.id}-PAY`,
          status: order.status,
          status_detail: order.statusDetail,
          amount: order.totalAmount,
          payment_method: buildOrderPaymentMethod(order),
        },
      ],
    },
  };
}

async function sendWebhook(order, action, { delayMs = 0, duplicateCount = 1 } = {}) {
  const fire = async () => {
    const requestId = crypto.randomUUID();
    const { xSignature } = signWebhook({ dataId: order.id, requestId, secret: WEBHOOK_SECRET });
    const body = JSON.stringify({
      action,
      api_version: "v1",
      application_id: "TEST-APP",
      data: {
        id: order.id,
        external_reference: order.externalReference,
        status: order.status,
        status_detail: order.statusDetail,
        total_amount: order.totalAmount,
        transactions: { payments: [{ amount: order.totalAmount, status: order.status, status_detail: order.statusDetail }] },
        type: "online",
      },
      date_created: new Date().toISOString(),
      live_mode: false,
      type: "order",
      user_id: "TEST-USER",
    });
    const url = `${APP_WEBHOOK_URL}?data.id=${encodeURIComponent(order.id)}`;
    try {
      for (let i = 0; i < duplicateCount; i++) {
        await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json", "x-signature": xSignature, "x-request-id": requestId },
          body,
        });
      }
    } catch (err) {
      console.error("[fake-mp] falha ao entregar webhook", String(err));
    }
  };

  if (delayMs > 0) {
    setTimeout(fire, delayMs);
    return;
  }
  await fire();
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => resolve(raw));
    req.on("error", reject);
  });
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) });
  res.end(payload);
}

async function handleCreateOrder(req, res) {
  if (chaos.mode !== "off" && (chaos.scope === "both" || chaos.scope === "create")) {
    if (chaos.mode === "timeout") return; // nunca responde — o SDK estoura o próprio timeout
    return sendJson(res, 500, { message: "simulated outage", error: "internal_error", status: 500 });
  }

  const raw = await readBody(req);
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return sendJson(res, 400, { message: "invalid json", error: "bad_request", status: 400 });
  }

  const idempotencyKey = req.headers["x-idempotency-key"];
  if (idempotencyKey && idempotencyIndex.has(idempotencyKey)) {
    const existing = orders.get(idempotencyIndex.get(idempotencyKey));
    return sendJson(res, 200, serializeOrder(existing));
  }

  const id = `FAKE-ORD-${String(nextOrderSeq++).padStart(6, "0")}`;
  const order = {
    id,
    externalReference: body.external_reference,
    totalAmount: body.total_amount,
    payerEmail: body.payer?.email,
    status: "action_required",
    statusDetail: "waiting_transfer",
  };
  orders.set(id, order);
  if (idempotencyKey) idempotencyIndex.set(idempotencyKey, id);

  return sendJson(res, 200, serializeOrder(order));
}

async function handleGetOrder(req, res, id) {
  if (chaos.mode !== "off" && (chaos.scope === "both" || chaos.scope === "get")) {
    if (chaos.mode === "timeout") return;
    return sendJson(res, 500, { message: "simulated outage", error: "internal_error", status: 500 });
  }
  const order = orders.get(id);
  if (!order) return sendJson(res, 404, { message: "order not found", error: "not_found", status: 404 });
  return sendJson(res, 200, serializeOrder(order));
}

async function handleControlTransition(req, res, id, { status, statusDetail, action }) {
  const order = orders.get(id);
  if (!order) return sendJson(res, 404, { error: "order not found" });

  const raw = await readBody(req);
  const options = raw ? JSON.parse(raw) : {};

  order.status = status;
  order.statusDetail = statusDetail;

  await sendWebhook(order, action, {
    delayMs: options.delayMs ?? 0,
    duplicateCount: options.duplicateCount ?? 1,
  });

  return sendJson(res, 200, { ok: true, order: serializeOrder(order) });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
    const parts = url.pathname.split("/").filter(Boolean);

    if (req.method === "POST" && url.pathname === "/v1/orders") {
      return await handleCreateOrder(req, res);
    }
    if (req.method === "GET" && parts[0] === "v1" && parts[1] === "orders" && parts.length === 3) {
      return await handleGetOrder(req, res, parts[2]);
    }
    if (req.method === "POST" && parts[0] === "v1" && parts[1] === "orders" && parts[3] === "process") {
      const order = orders.get(parts[2]);
      if (!order) return sendJson(res, 404, { error: "order not found" });
      return sendJson(res, 200, serializeOrder(order));
    }

    // --- endpoints de controle do teste (nunca existem na API real) ---
    if (req.method === "POST" && parts[0] === "__control__" && parts[1] === "orders" && parts[3] === "pay") {
      return await handleControlTransition(req, res, parts[2], {
        status: "processed",
        statusDetail: "accredited",
        action: "order.processed",
      });
    }
    if (req.method === "POST" && parts[0] === "__control__" && parts[1] === "orders" && parts[3] === "expire") {
      return await handleControlTransition(req, res, parts[2], {
        status: "cancelled",
        statusDetail: "expired",
        action: "order.cancelled",
      });
    }
    if (req.method === "POST" && parts[0] === "__control__" && parts[1] === "orders" && parts[3] === "fail") {
      return await handleControlTransition(req, res, parts[2], {
        status: "rejected",
        statusDetail: "cc_rejected_other_reason",
        action: "order.rejected",
      });
    }
    if (req.method === "GET" && parts[0] === "__control__" && parts[1] === "orders" && parts.length === 3) {
      const order = orders.get(parts[2]);
      if (!order) return sendJson(res, 404, { error: "order not found" });
      return sendJson(res, 200, serializeOrder(order));
    }
    if (req.method === "POST" && parts[0] === "__control__" && parts[1] === "chaos") {
      const raw = await readBody(req);
      chaos = { mode: "off", scope: "both", ...(raw ? JSON.parse(raw) : {}) };
      return sendJson(res, 200, { ok: true, chaos });
    }
    if (req.method === "POST" && parts[0] === "__control__" && parts[1] === "reset") {
      orders.clear();
      idempotencyIndex.clear();
      nextOrderSeq = 1;
      chaos = { mode: "off", scope: "both" };
      return sendJson(res, 200, { ok: true });
    }
    if (req.method === "GET" && parts[0] === "__control__" && parts[1] === "health") {
      return sendJson(res, 200, { ok: true, ordersCount: orders.size });
    }

    return sendJson(res, 404, { error: "unknown route", method: req.method, path: url.pathname });
  } catch (err) {
    console.error("[fake-mp] erro não tratado", err);
    return sendJson(res, 500, { error: "internal_error" });
  }
});

export function startFakeMp() {
  return new Promise((resolve) => {
    server.listen(PORT, "127.0.0.1", () => {
      console.log(`[fake-mp] escutando em http://127.0.0.1:${PORT}`);
      resolve(server);
    });
  });
}

export function stopFakeMp() {
  return new Promise((resolve) => server.close(resolve));
}

// Permite rodar como processo próprio (`node harness/fake-mp/server.mjs`) além
// de ser importado pelo orquestrador do harness.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startFakeMp();
}
