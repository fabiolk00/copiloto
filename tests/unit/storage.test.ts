import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSignedPdfUrl, PDF_OBJECT_PATHS, SIGNED_URL_TTL_SECONDS, type PdfObjectPath } from "@/lib/storage";

const ARQUIVO = PDF_OBJECT_PATHS[0];
const originalEnv = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY };

beforeEach(() => {
  process.env.SUPABASE_URL = "https://projeto.supabase.test/";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "chave-de-teste-nao-real";
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalEnv.url === undefined) delete process.env.SUPABASE_URL;
  else process.env.SUPABASE_URL = originalEnv.url;
  if (originalEnv.key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = originalEnv.key;
});

function stubFetch(response: Partial<Response> & { json?: () => Promise<unknown> }) {
  const fn = vi.fn(async () => response as Response);
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("createSignedPdfUrl", () => {
  it("monta a URL assinada e envia TTL de 300 s, sem a chave na URL", async () => {
    const fetchMock = stubFetch({
      ok: true,
      json: async () => ({ signedURL: `/object/sign/pdfs/${ARQUIVO}?token=abc` }),
    });
    const url = await createSignedPdfUrl(ARQUIVO);
    expect(url).toBe(`https://projeto.supabase.test/storage/v1/object/sign/pdfs/${ARQUIVO}?token=abc`);
    expect(url).not.toContain("chave-de-teste-nao-real");

    const [calledUrl, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(calledUrl).toBe(`https://projeto.supabase.test/storage/v1/object/sign/pdfs/${ARQUIVO}`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ expiresIn: SIGNED_URL_TTL_SECONDS });
    expect(SIGNED_URL_TTL_SECONDS).toBe(300);
  });

  it("caminho fora da allowlist: lança antes de qualquer chamada de rede", async () => {
    const fetchMock = stubFetch({ ok: true });
    await expect(createSignedPdfUrl("../segredo.pdf" as PdfObjectPath)).rejects.toThrow("não permitido");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sem SUPABASE_URL ou chave: lança, sem chamar a rede", async () => {
    const fetchMock = stubFetch({ ok: true });
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    await expect(createSignedPdfUrl(ARQUIVO)).rejects.toThrow("Storage não configurado");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a mensagem diz qual variável falta, sem imprimir valor", async () => {
    const fetchMock = stubFetch({ ok: true });
    delete process.env.SUPABASE_URL;
    await expect(createSignedPdfUrl(ARQUIVO)).rejects.toThrow("SUPABASE_URL ausente");
    process.env.SUPABASE_URL = "https://projeto.supabase.test/";
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    await expect(createSignedPdfUrl(ARQUIVO)).rejects.toThrow("SUPABASE_SERVICE_ROLE_KEY ausente");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("HTTP de erro: a mensagem leva só o código, não o corpo", async () => {
    stubFetch({ ok: false, status: 500, json: async () => ({ message: "detalhe interno" }) });
    const err = await createSignedPdfUrl(ARQUIVO).catch((e: Error) => e);
    expect((err as Error).message).toBe("Falha ao assinar o PDF (HTTP 500).");
    expect((err as Error).message).not.toContain("detalhe interno");
  });

  it.each([
    ["signedURL ausente", {}],
    ["signedURL de outro bucket", { signedURL: "/object/sign/outro/x.pdf?token=1" }],
    ["signedURL absoluta externa", { signedURL: "https://evil.example/x.pdf" }],
    ["signedURL não string", { signedURL: 42 }],
  ])("resposta inesperada (%s): lança", async (_nome, corpo) => {
    stubFetch({ ok: true, json: async () => corpo });
    await expect(createSignedPdfUrl(ARQUIVO)).rejects.toThrow("Resposta inesperada");
  });
});
