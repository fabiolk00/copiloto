import { describe, expect, it } from "vitest";
import { verifyMpWebhookSignature } from "@/lib/mp-signature";
import { buildSignatureHeader } from "../helpers/mp-signature";

const SECRET = "segredo-de-teste";
const ORDER_ID = "ORD01M6GZZC4KB25BYM0PJ7PTKX2E";
const REQ = "ce3039f6-c9c0-4483-90f6-160fc220777c";

function assinar(dataId: string, over: { secret?: string; ts?: number; requestId?: string } = {}) {
  return buildSignatureHeader({ dataId, requestId: over.requestId ?? REQ, secret: over.secret ?? SECRET, ts: over.ts });
}

describe("verifyMpWebhookSignature", () => {
  it("assinatura sobre o id exatamente como recebido (maiúsculas): válida, variante original", () => {
    const { xSignature } = assinar(ORDER_ID);
    expect(verifyMpWebhookSignature({ xSignature, xRequestId: REQ, dataId: ORDER_ID, secret: SECRET })).toEqual({
      ok: true,
      idVariant: "original",
    });
  });

  it("assinatura sobre o id em minúsculas e URL em maiúsculas: válida, variante minúscula", () => {
    const { xSignature } = assinar(ORDER_ID.toLowerCase());
    expect(verifyMpWebhookSignature({ xSignature, xRequestId: REQ, dataId: ORDER_ID, secret: SECRET })).toEqual({
      ok: true,
      idVariant: "minusculo",
    });
  });

  it("id numérico (como o da simulação do painel) continua válido pela variante original", () => {
    const { xSignature } = assinar("123456");
    expect(verifyMpWebhookSignature({ xSignature, xRequestId: REQ, dataId: "123456", secret: SECRET }).ok).toBe(true);
  });

  it("segredo errado é recusado nas duas variantes, com SignatureMismatch", () => {
    for (const id of [ORDER_ID, ORDER_ID.toLowerCase()]) {
      const { xSignature } = assinar(id, { secret: "outro-segredo" });
      const r = verifyMpWebhookSignature({ xSignature, xRequestId: REQ, dataId: ORDER_ID, secret: SECRET });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe("SignatureMismatch");
    }
  });

  it("id adulterado (assinatura de outra order) é recusado, mesmo com a variante minúscula", () => {
    const { xSignature } = assinar("ord01outraorderqualquer");
    const r = verifyMpWebhookSignature({ xSignature, xRequestId: REQ, dataId: ORDER_ID, secret: SECRET });
    expect(r.ok).toBe(false);
  });

  it("x-request-id adulterado é recusado", () => {
    const { xSignature } = assinar(ORDER_ID.toLowerCase());
    const r = verifyMpWebhookSignature({ xSignature, xRequestId: "outro-request-id", dataId: ORDER_ID, secret: SECRET });
    expect(r.ok).toBe(false);
  });

  it("timestamp fora da tolerância é recusado, e a variante minúscula não o contorna (replay)", () => {
    const velho = Math.floor(Date.now() / 1000) - 3600;
    for (const id of [ORDER_ID, ORDER_ID.toLowerCase()]) {
      const { xSignature } = assinar(id, { ts: velho });
      const r = verifyMpWebhookSignature({ xSignature, xRequestId: REQ, dataId: ORDER_ID, secret: SECRET });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe("TimestampOutOfTolerance");
    }
  });

  it("header ausente ou malformado é recusado com o motivo correto", () => {
    const ausente = verifyMpWebhookSignature({ xSignature: null, xRequestId: REQ, dataId: ORDER_ID, secret: SECRET });
    expect(ausente.ok).toBe(false);
    if (!ausente.ok) expect(ausente.reason).toBe("MissingSignatureHeader");

    const malformado = verifyMpWebhookSignature({ xSignature: "lixo", xRequestId: REQ, dataId: ORDER_ID, secret: SECRET });
    expect(malformado.ok).toBe(false);
  });

  it("reporta se o id tinha maiúsculas, para diagnóstico", () => {
    const r1 = verifyMpWebhookSignature({ xSignature: "ts=1,v1=aa", xRequestId: REQ, dataId: ORDER_ID, secret: SECRET });
    const r2 = verifyMpWebhookSignature({ xSignature: "ts=1,v1=aa", xRequestId: REQ, dataId: "123456", secret: SECRET });
    if (!r1.ok) expect(r1.idComMaiusculas).toBe(true);
    if (!r2.ok) expect(r2.idComMaiusculas).toBe(false);
  });

  it("o resultado de falha nunca contém o segredo nem a assinatura", () => {
    const { xSignature } = assinar(ORDER_ID, { secret: "outro" });
    const r = verifyMpWebhookSignature({ xSignature, xRequestId: REQ, dataId: ORDER_ID, secret: SECRET });
    const texto = JSON.stringify(r);
    expect(texto).not.toContain(SECRET);
    expect(texto).not.toContain(xSignature.split("v1=")[1]);
  });
});
