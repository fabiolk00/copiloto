import { describe, expect, it } from "vitest";
import {
  amountsMatch,
  buildExternalReference,
  buildIdempotencyKey,
  buildPixOrderPayload,
  isoDurationToMs,
  mapMpPaymentStatus,
} from "@/lib/pix";
import { PRICE_BRL } from "@/lib/guias";

describe("isoDurationToMs", () => {
  it.each([
    ["PT30M", 30 * 60 * 1000],
    ["PT1H", 60 * 60 * 1000],
    ["P1D", 24 * 60 * 60 * 1000],
    ["P1DT2H3M4S", (24 * 60 * 60 + 2 * 60 * 60 + 3 * 60 + 4) * 1000],
    ["PT45S", 45 * 1000],
    ["P30D", 30 * 24 * 60 * 60 * 1000],
  ])("converte %s para %i ms", (duration, expected) => {
    expect(isoDurationToMs(duration)).toBe(expected);
  });

  it("rejeita durações fora do subconjunto suportado", () => {
    expect(() => isoDurationToMs("not-a-duration")).toThrow(/inválida/);
    expect(() => isoDurationToMs("")).toThrow(/inválida/);
    expect(() => isoDurationToMs("1D")).toThrow(/inválida/); // falta o "P" inicial
    expect(() => isoDurationToMs("P1Y")).toThrow(/inválida/); // anos não são suportados
  });
});

describe("buildExternalReference", () => {
  it("combina clientToken e attempt com separador que a Mercado Pago aceita (sem ':')", () => {
    expect(buildExternalReference("abc-123", 1)).toBe("abc-123-a1");
    expect(buildExternalReference("abc-123", 2)).toBe("abc-123-a2");
  });

  it("não contém ':'", () => {
    expect(buildExternalReference("token", 7)).not.toContain(":");
  });
});

describe("buildIdempotencyKey", () => {
  it("é estável para o mesmo pedido+tentativa", () => {
    const a = buildIdempotencyKey("token-1", 1);
    const b = buildIdempotencyKey("token-1", 1);
    expect(a).toBe(b);
  });

  it("muda quando a tentativa muda, mesmo para o mesmo clientToken", () => {
    const attempt1 = buildIdempotencyKey("token-1", 1);
    const attempt2 = buildIdempotencyKey("token-1", 2);
    expect(attempt1).not.toBe(attempt2);
  });

  it("muda quando o clientToken muda, mesmo para a mesma tentativa", () => {
    const tokenA = buildIdempotencyKey("token-a", 1);
    const tokenB = buildIdempotencyKey("token-b", 1);
    expect(tokenA).not.toBe(tokenB);
  });
});

describe("buildPixOrderPayload", () => {
  it("usa sempre PRICE_BRL formatado como string decimal, independente de qualquer valor do cliente", () => {
    const payload = buildPixOrderPayload({
      externalReference: "ref-1",
      payerEmail: "comprador@example.com",
      expiration: "PT30M",
    });

    expect(payload.total_amount).toBe(PRICE_BRL.toFixed(2));
    expect(payload.total_amount).toBe("29.90");
    expect(payload.transactions.payments[0].amount).toBe("29.90");
  });

  it("a assinatura da função não aceita um valor de pedido vindo do cliente — não há como injetar um preço diferente", () => {
    // Simula um objeto malicioso vindo de fora do tipo (ex.: JSON.parse de um corpo de requisição),
    // onde o TypeScript não teria como aplicar excess-property checking.
    const attackerControlledInput: Record<string, unknown> = {
      externalReference: "ref-1",
      payerEmail: "comprador@example.com",
      expiration: "PT30M",
      amount: "0.01",
      total_amount: "0.01",
    };
    const payloadWithInjectedAmount = buildPixOrderPayload(
      attackerControlledInput as Parameters<typeof buildPixOrderPayload>[0]
    );

    expect(payloadWithInjectedAmount.total_amount).toBe("29.90");
  });

  it("propaga external_reference, payer e expiration_time informados", () => {
    const payload = buildPixOrderPayload({
      externalReference: "token-xyz-a3",
      payerEmail: "outro@example.com",
      expiration: "PT1H",
    });

    expect(payload.external_reference).toBe("token-xyz-a3");
    expect(payload.payer).toEqual({ email: "outro@example.com" });
    expect(payload.transactions.payments[0].expiration_time).toBe("PT1H");
    expect(payload.transactions.payments[0].payment_method).toEqual({
      id: "pix",
      type: "bank_transfer",
    });
    expect(payload.type).toBe("online");
    expect(payload.processing_mode).toBe("automatic");
  });
});

describe("mapMpPaymentStatus", () => {
  it.each([
    ["approved", undefined, "pago"],
    ["processed", "accredited", "pago"],
    ["processed", "pending_review", null],
    ["rejected", undefined, "falhou"],
    ["rejected", "cc_rejected_other_reason", "falhou"],
    ["cancelled", undefined, "cancelado"],
    ["action_required", "waiting_transfer", null],
    [undefined, undefined, null],
    ["unknown_status", "whatever", null],
  ] as const)("status=%s statusDetail=%s -> %s", (status, statusDetail, expected) => {
    expect(mapMpPaymentStatus(status, statusDetail)).toBe(expected);
  });
});

describe("amountsMatch", () => {
  it("considera iguais valores idênticos", () => {
    expect(amountsMatch("29.90", "29.90")).toBe(true);
  });

  it("tolera diferenças de representação dentro de meio centavo", () => {
    expect(amountsMatch("29.9", "29.90")).toBe(true);
    expect(amountsMatch("29.900000001", "29.90")).toBe(true);
  });

  it("rejeita valores diferentes", () => {
    expect(amountsMatch("0.01", "29.90")).toBe(false);
    expect(amountsMatch("29.91", "29.90")).toBe(false);
  });

  it("rejeita quando o valor da Mercado Pago está ausente ou não é numérico", () => {
    expect(amountsMatch(undefined, "29.90")).toBe(false);
    expect(amountsMatch("abc", "29.90")).toBe(false);
  });
});
