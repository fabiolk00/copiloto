import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { backoffSegundos, BACKOFF_MINUTOS } from "@/lib/email-queue";
import { buildCurriculoLink, buildGuiaLink, buildLogoUrl, escapeHtml, renderGuiaEmail } from "@/lib/email-template";
import { hasHeaderInjection, maskEmail } from "@/lib/email";
import { verifyResendWebhook } from "@/lib/resend-signature";

const MSG = { to: "pagador@example.com", subject: "Assunto", html: "<p>oi</p>", text: "oi", idempotencyKey: "guia-pago/1" };

function resposta(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

async function carregarSender(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return (await import("@/lib/email")).sendEmailViaResend;
}

describe("sendEmailViaResend — classificação de erros", () => {
  const salvo = { k: process.env.RESEND_API_KEY, f: process.env.EMAIL_FROM, r: process.env.EMAIL_REPLY_TO };
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => {
    vi.unstubAllGlobals();
    for (const [k, v] of [["RESEND_API_KEY", salvo.k], ["EMAIL_FROM", salvo.f], ["EMAIL_REPLY_TO", salvo.r]] as const) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    vi.resetModules();
  });

  const CONFIG = { RESEND_API_KEY: "re_chave_de_teste", EMAIL_FROM: "Guia <guia@envio.example.test>" };

  it("sucesso: devolve o id e envia a chave de idempotência e o Bearer, sem expor a chave no corpo", async () => {
    const send = await carregarSender(CONFIG);
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(resposta(200, { id: "em_123" }));
    expect(await send(MSG)).toEqual({ ok: true, id: "em_123" });
    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers["Idempotency-Key"]).toBe("guia-pago/1");
    expect(init.headers.Authorization).toBe("Bearer re_chave_de_teste");
    expect(init.body).not.toContain("re_chave_de_teste");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("envia reply_to só quando EMAIL_REPLY_TO está definido e recusa injeção de cabeçalho nele", async () => {
    const sem = await carregarSender({ ...CONFIG, EMAIL_REPLY_TO: undefined });
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(resposta(200, { id: "em_1" }));
    await sem(MSG);
    expect(JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body)).not.toHaveProperty("reply_to");

    const com = await carregarSender({ ...CONFIG, EMAIL_REPLY_TO: "suporte@example.test" });
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(resposta(200, { id: "em_2" }));
    await com(MSG);
    expect(JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[1][1].body).reply_to).toBe("suporte@example.test");

    const ruim = await carregarSender({ ...CONFIG, EMAIL_REPLY_TO: "a@example.test\r\nBcc: x@y.z" });
    expect(await ruim(MSG)).toMatchObject({ ok: false, kind: "permanente" });
  });

  it.each([
    [500, {}, "transitorio"],
    [503, {}, "transitorio"],
    [409, { name: "concurrent_idempotent_requests" }, "transitorio"],
    [409, { name: "invalid_idempotent_request" }, "permanente"],
    [400, { name: "validation_error" }, "permanente"],
    [422, { name: "invalid_parameter" }, "permanente"],
    [401, { name: "invalid_api_key" }, "configuracao"],
    [403, { name: "restricted_api_key" }, "configuracao"],
    [429, { name: "rate_limit_exceeded" }, "taxa"],
    [429, { name: "daily_quota_exceeded" }, "cota"],
    [429, { name: "monthly_quota_exceeded" }, "cota"],
  ])("HTTP %i %j -> %s", async (status, body, kind) => {
    const send = await carregarSender(CONFIG);
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(resposta(status, body));
    const r = await send(MSG);
    expect(r).toMatchObject({ ok: false, kind });
  });

  it("429 por taxa respeita o header retry-after", async () => {
    const send = await carregarSender(CONFIG);
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(resposta(429, { name: "rate_limit_exceeded" }, { "retry-after": "7" }));
    expect(await send(MSG)).toMatchObject({ kind: "taxa", retryAfterSec: 7 });
  });

  it("falha de rede e timeout são transitórios", async () => {
    const send = await carregarSender(CONFIG);
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(Object.assign(new Error("x"), { name: "TimeoutError" }));
    expect(await send(MSG)).toMatchObject({ ok: false, kind: "transitorio" });
  });

  it("sem chave ou sem remetente: configuração, sem chamar a rede", async () => {
    let send = await carregarSender({ RESEND_API_KEY: undefined, EMAIL_FROM: CONFIG.EMAIL_FROM });
    expect(await send(MSG)).toMatchObject({ kind: "configuracao" });
    send = await carregarSender({ RESEND_API_KEY: CONFIG.RESEND_API_KEY, EMAIL_FROM: undefined });
    expect(await send(MSG)).toMatchObject({ kind: "configuracao" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("CR/LF no destinatário ou no assunto é recusado antes da rede", async () => {
    const send = await carregarSender(CONFIG);
    expect(await send({ ...MSG, to: "a@b.com\r\nBcc: x@y.com" })).toMatchObject({ kind: "permanente" });
    expect(await send({ ...MSG, subject: "oi\nBcc: x@y.com" })).toMatchObject({ kind: "permanente" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("a mensagem de erro nunca carrega o corpo da resposta nem o e-mail", async () => {
    const send = await carregarSender(CONFIG);
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      resposta(400, { name: "validation_error", message: "pagador@example.com é inválido" })
    );
    const r = await send(MSG);
    expect(JSON.stringify(r)).not.toContain("pagador@example.com");
  });
});

describe("helpers de e-mail", () => {
  it("maskEmail esconde o usuário", () => {
    expect(maskEmail("fabio@dominio.com")).toBe("f***@dominio.com");
    expect(maskEmail("sem-arroba")).toBe("***");
  });

  it("hasHeaderInjection pega CR, LF e controle", () => {
    expect(hasHeaderInjection("a@b.com")).toBe(false);
    expect(hasHeaderInjection("a@b.com\r\nBcc: x")).toBe(true);
    expect(hasHeaderInjection("a@b.com\u0000")).toBe(true);
  });

  it("backoff: 1, 5, 15, 60 e 180 min, com jitter de no máximo 10%", () => {
    BACKOFF_MINUTOS.forEach((min, i) => {
      expect(backoffSegundos(i + 1, () => 0.5)).toBe(min * 60);
      expect(backoffSegundos(i + 1, () => 0)).toBe(Math.round(min * 60 * 0.9));
      expect(backoffSegundos(i + 1, () => 1)).toBe(Math.round(min * 60 * 1.1));
    });
    // Soma das esperas fica abaixo das 24 h da chave de idempotência do Resend.
    expect(BACKOFF_MINUTOS.reduce((a, b) => a + b, 0)).toBeLessThan(24 * 60);
  });
});

describe("template do e-mail", () => {
  it("escapa HTML e traz versão em texto com o link", () => {
    expect(escapeHtml(`<script>"x"&'y'</script>`)).toBe("&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/script&gt;");
    const link = buildGuiaLink("https://app.example.test/", "11111111-1111-4111-8111-111111111111");
    expect(link).toBe("https://app.example.test/api/orders/11111111-1111-4111-8111-111111111111/guia");
    const curriculoLink = buildCurriculoLink("https://app.example.test/", "11111111-1111-4111-8111-111111111111");
    expect(curriculoLink).toBe("https://app.example.test/api/orders/11111111-1111-4111-8111-111111111111/curriculo");
    const { subject, html, text } = renderGuiaEmail({ areaSlug: "financeiro", trilha: "crescer", link, curriculoLink });
    expect(subject).not.toMatch(/[\r\n]/);
    expect(html).toContain(link);
    expect(text).toContain(link);
    expect(html).toContain("Financeiro");
    // O currículo vai no MESMO e-mail do guia, em HTML e em texto.
    expect(html).toContain(curriculoLink);
    expect(text).toContain(curriculoLink);
    expect(html).toContain("Baixar o modelo de currículo");
  });

  it.each(["crescer", "mudar", null])("o link do currículo está no e-mail com a trilha %s", (trilha) => {
    const { html, text } = renderGuiaEmail({
      areaSlug: "comercial",
      trilha,
      link: "https://a.test/guia",
      curriculoLink: "https://a.test/curriculo",
    });
    expect(html).toContain("https://a.test/curriculo");
    expect(text).toContain("https://a.test/curriculo");
  });

  it("cabeçalho com o símbolo (PNG absoluto, tamanho fixo) e o nome da marca em texto", () => {
    expect(buildLogoUrl("https://app.example.test/")).toBe("https://app.example.test/logo-email.png");
    const { html } = renderGuiaEmail({
      areaSlug: "financeiro",
      trilha: "crescer",
      link: "https://a.test/x",
      curriculoLink: "https://a.test/c",
      logoUrl: buildLogoUrl("https://app.example.test"),
    });
    expect(html).toContain('<img src="https://app.example.test/logo-email.png" width="40" height="40" alt=""');
    expect(html).toContain("Copiloto Carreira");
    expect(html).not.toContain(".svg");
  });

  it("sem logoUrl: só o nome da marca, sem <img>", () => {
    const { html } = renderGuiaEmail({ areaSlug: "financeiro", trilha: "crescer", link: "https://a.test/x", curriculoLink: "https://a.test/c" });
    expect(html).not.toContain("<img");
    expect(html).toContain("Copiloto Carreira");
  });

  it("área ou trilha fora da lista fechada nunca entram crus no corpo", () => {
    const { html, text } = renderGuiaEmail({ areaSlug: "<img src=x onerror=alert(1)>", trilha: "<b>", link: "https://a.test/x", curriculoLink: "https://a.test/c" });
    expect(html).not.toContain("onerror");
    expect(text).not.toContain("onerror");
    expect(html).not.toContain("<b>");
  });

  it("o corpo não traz URL assinada do Storage nem timestamp (idempotência exige corpo estável)", () => {
    const a = renderGuiaEmail({ areaSlug: "comercial", trilha: "mudar", link: "https://a.test/x", curriculoLink: "https://a.test/c" });
    const b = renderGuiaEmail({ areaSlug: "comercial", trilha: "mudar", link: "https://a.test/x", curriculoLink: "https://a.test/c" });
    expect(a).toEqual(b);
    expect(a.html).not.toMatch(/storage\/v1|token=/);
  });
});

describe("verifyResendWebhook (Svix)", () => {
  const segredoBytes = Buffer.from("segredo-de-teste-svix-0123456789");
  const secret = `whsec_${segredoBytes.toString("base64")}`;
  const body = JSON.stringify({ type: "email.delivered", data: { email_id: "em_1" } });
  const agora = 1_800_000_000;

  function assinar(id: string, ts: number, corpo: string) {
    return `v1,${createHmac("sha256", segredoBytes).update(`${id}.${ts}.${corpo}`).digest("base64")}`;
  }
  const base = { rawBody: body, svixId: "msg_1", svixTimestamp: String(agora), secret, nowMs: agora * 1000 };

  it("aceita assinatura válida, inclusive entre várias (rotação)", () => {
    const ok = assinar("msg_1", agora, body);
    expect(verifyResendWebhook({ ...base, svixSignature: ok })).toEqual({ ok: true });
    expect(verifyResendWebhook({ ...base, svixSignature: `v1,AAAA ${ok}` })).toEqual({ ok: true });
  });

  it("recusa corpo alterado, id diferente, segredo errado e cabeçalhos ausentes", () => {
    const ok = assinar("msg_1", agora, body);
    expect(verifyResendWebhook({ ...base, rawBody: body + " ", svixSignature: ok })).toMatchObject({ ok: false, reason: "assinatura" });
    expect(verifyResendWebhook({ ...base, svixId: "msg_2", svixSignature: ok })).toMatchObject({ ok: false });
    expect(verifyResendWebhook({ ...base, secret: "whsec_" + Buffer.from("outro").toString("base64"), svixSignature: ok })).toMatchObject({ ok: false });
    expect(verifyResendWebhook({ ...base, svixSignature: null })).toMatchObject({ ok: false, reason: "cabecalhos" });
  });

  it("recusa timestamp fora da janela de 5 min (passado e futuro)", () => {
    const velho = agora - 6 * 60;
    expect(verifyResendWebhook({ ...base, svixTimestamp: String(velho), svixSignature: assinar("msg_1", velho, body) })).toMatchObject({ reason: "timestamp" });
    const futuro = agora + 6 * 60;
    expect(verifyResendWebhook({ ...base, svixTimestamp: String(futuro), svixSignature: assinar("msg_1", futuro, body) })).toMatchObject({ reason: "timestamp" });
    expect(verifyResendWebhook({ ...base, svixTimestamp: "abc", svixSignature: "v1,x" })).toMatchObject({ reason: "timestamp" });
  });
});
