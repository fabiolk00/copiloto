import { describe, expect, it } from "vitest";
import { sendEmailViaResend } from "@/lib/email";
import { buildGuiaLink, buildLogoUrl, renderGuiaEmail } from "@/lib/email-template";

// Teste contra a API real do Resend. Só roda com RESEND_LIVE_TEST=1, RESEND_API_KEY
// e EMAIL_FROM no ambiente. Só envia para os endereços de teste do Resend
// (delivered@ e bounced@resend.dev): nenhum destinatário real, nenhum pedido real,
// token fictício no link. Nenhuma chave é impressa.
const enabled = process.env.RESEND_LIVE_TEST === "1";

describe.skipIf(!enabled)("Resend (ao vivo)", () => {
  const rodada = `smoke-${Date.now()}`;
  const base = process.env.APP_URL || "https://www.copilotocarreira.com.br";
  const msg = renderGuiaEmail({
    areaSlug: "financeiro",
    trilha: "crescer",
    link: buildGuiaLink(base, "00000000-0000-4000-8000-000000000000"),
    logoUrl: buildLogoUrl(base),
  });

  it("delivered@resend.dev: o Resend aceita e devolve um id", async () => {
    const r = await sendEmailViaResend({ to: "delivered@resend.dev", ...msg, idempotencyKey: `${rodada}/delivered` });
    expect(r).toMatchObject({ ok: true });
  });

  it("bounced@resend.dev: o Resend aceita o envio (o bounce chega depois, por webhook)", async () => {
    const r = await sendEmailViaResend({ to: "bounced@resend.dev", ...msg, idempotencyKey: `${rodada}/bounced` });
    expect(r).toMatchObject({ ok: true });
  });

  it("mesma chave de idempotência e mesmo corpo: devolve o MESMO id (sem segundo e-mail)", async () => {
    const a = await sendEmailViaResend({ to: "delivered@resend.dev", ...msg, idempotencyKey: `${rodada}/idem` });
    const b = await sendEmailViaResend({ to: "delivered@resend.dev", ...msg, idempotencyKey: `${rodada}/idem` });
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) expect(b.id).toBe(a.id);
  });

  it("mesma chave com corpo diferente: erro permanente (bug nosso), sem retry", async () => {
    await sendEmailViaResend({ to: "delivered@resend.dev", ...msg, idempotencyKey: `${rodada}/conflito` });
    const r = await sendEmailViaResend({
      to: "delivered@resend.dev",
      ...msg,
      text: `${msg.text}\noutro corpo`,
      idempotencyKey: `${rodada}/conflito`,
    });
    expect(r).toMatchObject({ ok: false, kind: "permanente" });
  });
});
