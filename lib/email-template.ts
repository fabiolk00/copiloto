/**
 * Corpo do e-mail do guia. HTML montado à mão com escape de tudo que não é
 * literal: só entram dados de lista fechada (nome da área, rótulo da trilha) e
 * o link, que vem de APP_URL + client_token. Nunca `dangerouslySetInnerHTML`.
 * Versão em texto puro sempre junto.
 */
import { BRAND_NAME, TRILHAS, getAreaBySlug } from "@/lib/guias";

export const EMAIL_SUBJECT = `Seu guia de carreira está pronto - ${BRAND_NAME}`;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildGuiaLink(appUrl: string, clientToken: string): string {
  return `${appUrl.replace(/\/+$/, "")}/api/orders/${encodeURIComponent(clientToken)}/guia`;
}

export function renderGuiaEmail(params: {
  areaSlug: string;
  trilha: string | null;
  link: string;
}): { subject: string; html: string; text: string } {
  const area = getAreaBySlug(params.areaSlug);
  const trilha = TRILHAS.find((t) => t.id === params.trilha);
  // Lista fechada: se algo fugir do esperado, cai num texto genérico, nunca no dado cru.
  const areaNome = area?.name ?? "carreira";
  const trilhaRotulo = trilha?.rotulo ?? "";
  const linhaGuia = trilhaRotulo ? `${areaNome} - ${trilhaRotulo}` : areaNome;

  const text = [
    "Obrigado pela compra.",
    "",
    `Seu guia (${linhaGuia}) está pronto. Baixe pelo link abaixo:`,
    params.link,
    "",
    "O link continua valendo: você pode voltar a ele quando quiser.",
    "Se você não fez esta compra, ignore este e-mail.",
    "",
    BRAND_NAME,
  ].join("\n");

  const html = `<!doctype html>
<html lang="pt-BR"><body style="margin:0;padding:24px;background:#f5efe6;font-family:Arial,Helvetica,sans-serif;color:#2b2420;">
<table role="presentation" width="100%" style="max-width:520px;margin:0 auto;background:#fbf8f2;border:1px solid #dccfbd;border-radius:12px;">
<tr><td style="padding:28px;">
<p style="margin:0 0 12px;font-size:18px;font-weight:bold;">Seu guia está pronto</p>
<p style="margin:0 0 20px;font-size:15px;line-height:1.5;">Obrigado pela compra. Seu guia (${escapeHtml(linhaGuia)}) pode ser baixado pelo botão abaixo.</p>
<p style="margin:0 0 20px;"><a href="${escapeHtml(params.link)}" style="display:inline-block;padding:12px 20px;background:#2b2420;color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;">Baixar o guia</a></p>
<p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#4a403a;">O link continua valendo: você pode voltar a ele quando quiser.</p>
<p style="margin:0;font-size:13px;line-height:1.5;color:#4a403a;">Se você não fez esta compra, ignore este e-mail.</p>
</td></tr></table>
</body></html>`;

  return { subject: EMAIL_SUBJECT, html, text };
}
