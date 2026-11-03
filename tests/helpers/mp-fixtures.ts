/**
 * Fixtures fiéis ao formato documentado da Orders API da Mercado Pago para
 * um Pix: `status: "action_required"`, `status_detail: "waiting_transfer"`
 * e `transactions.payments[0].payment_method` com `qr_code`,
 * `qr_code_base64` e `ticket_url`.
 */
export function buildPixOrderCreateResponse(overrides: {
  id?: string;
  externalReference?: string;
  amount?: string;
} = {}) {
  const amount = overrides.amount ?? "29.90";
  return {
    id: overrides.id ?? "ORD-0001",
    type: "online",
    external_reference: overrides.externalReference ?? "client-token-a1",
    status: "action_required",
    status_detail: "waiting_transfer",
    total_amount: amount,
    transactions: {
      payments: [
        {
          id: "PAY-0001",
          status: "action_required",
          status_detail: "waiting_transfer",
          amount,
          payment_method: {
            id: "pix",
            type: "bank_transfer",
            qr_code: "00020126580014br.gov.bcb.pix...6304ABCD",
            qr_code_base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB",
            ticket_url: "https://www.mercadopago.com/pix/ticket/ORD-0001",
          },
        },
      ],
    },
  };
}

/** Resposta de GET /v1/orders/{id} para um Pix pago (confirmado no app real: "processed" + "accredited"). */
export function buildPixOrderGetResponsePaid(overrides: {
  amount?: string;
} = {}) {
  const amount = overrides.amount ?? "29.90";
  return {
    id: "ORD-0001",
    status: "processed",
    status_detail: "accredited",
    total_amount: amount,
    transactions: {
      payments: [
        {
          id: "PAY-0001",
          status: "processed",
          status_detail: "accredited",
          amount,
          payment_method: { id: "pix", type: "bank_transfer" },
        },
      ],
    },
  };
}

export function buildPixOrderGetResponsePending() {
  return {
    id: "ORD-0001",
    status: "action_required",
    status_detail: "waiting_transfer",
    total_amount: "29.90",
    transactions: {
      payments: [
        {
          id: "PAY-0001",
          status: "action_required",
          status_detail: "waiting_transfer",
          amount: "29.90",
          payment_method: { id: "pix", type: "bank_transfer" },
        },
      ],
    },
  };
}

export function buildPixOrderGetResponseCancelled() {
  return {
    id: "ORD-0001",
    status: "cancelled",
    status_detail: "expired",
    total_amount: "29.90",
    transactions: {
      payments: [
        {
          id: "PAY-0001",
          status: "cancelled",
          status_detail: "expired",
          amount: "29.90",
          payment_method: { id: "pix", type: "bank_transfer" },
        },
      ],
    },
  };
}
