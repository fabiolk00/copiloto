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

/**
 * PNG público do símbolo (clientes de e-mail não renderizam SVG). Precisa ser
 * URL absoluta e acessível sem login; o arquivo vive em public/logo-email.png.
 */
export function buildLogoUrl(appUrl: string): string {
  return `${appUrl.replace(/\/+$/, "")}/logo-email.png`;
}

export function renderGuiaEmail(params: {
  areaSlug: string;
  trilha: string | null;
  link: string;
  /** URL absoluta do símbolo. Sem ela, o cabeçalho mostra só o nome da marca. */
  logoUrl?: string;
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
    "Se você não fez esta compra, ignore este e-mail. Dúvidas? É só responder esta mensagem.",
    "",
    BRAND_NAME,
  ].join("\n");

  // Símbolo + nome da marca. O nome fica em texto ao lado, então com imagens
  // bloqueadas (padrão em vários clientes) a marca continua aparecendo; por isso alt vazio.
  const simbolo = params.logoUrl
    ? `<td style="padding-right:10px;vertical-align:middle;"><img src="${escapeHtml(params.logoUrl)}" width="40" height="40" alt="" style="display:block;border:0;width:40px;height:40px;"></td>`
    : "";
  const cabecalho = `<table role="presentation" style="margin:0 0 22px;"><tr>${simbolo}<td style="vertical-align:middle;font-family:Georgia,'Times New Roman',serif;font-size:21px;letter-spacing:-0.015em;color:#2a2420;white-space:nowrap;">${escapeHtml(BRAND_NAME)}</td></tr></table>`;

  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(EMAIL_SUBJECT)}</title></head><body style="margin:0;padding:24px;background:#f5efe6;font-family:Arial,Helvetica,sans-serif;color:#2b2420;">
<table role="presentation" width="100%" style="max-width:520px;margin:0 auto;background:#fbf8f2;border:1px solid #dccfbd;border-radius:12px;">
<tr><td style="padding:28px;">
${cabecalho}
<p style="margin:0 0 12px;font-size:18px;font-weight:bold;">Seu guia está pronto</p>
<p style="margin:0 0 20px;font-size:15px;line-height:1.5;">Obrigado pela compra. Seu guia (${escapeHtml(linhaGuia)}) pode ser baixado pelo botão abaixo.</p>
<p style="margin:0 0 20px;"><a href="${escapeHtml(params.link)}" style="display:inline-block;padding:12px 20px;background:#2b2420;color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;">Baixar o guia</a></p>
<p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#4a403a;">Se o botão não abrir, copie e cole este endereço no navegador:<br>${escapeHtml(params.link)}</p>
<p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#4a403a;">O link continua valendo: você pode voltar a ele quando quiser.</p>
<p style="margin:0;font-size:13px;line-height:1.5;color:#4a403a;">Se você não fez esta compra, ignore este e-mail. Dúvidas? É só responder esta mensagem.</p>
</td></tr></table>
</body></html>`;

  return { subject: EMAIL_SUBJECT, html, text };
}
