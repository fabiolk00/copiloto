import { describe, expect, it } from "vitest";
import { createSignedPdfUrl, CURRICULO_OBJECT_PATHS, PDF_BUCKET, PDF_OBJECT_PATHS } from "@/lib/storage";

// Teste contra o Supabase Storage real. Só roda com SUPABASE_LIVE_TEST=1,
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY definidos no ambiente. Não baixa o
// conteúdo dos PDFs: a checagem usa HEAD, e nenhuma URL ou chave é impressa.
const enabled = process.env.SUPABASE_LIVE_TEST === "1";

describe.skipIf(!enabled)("Supabase Storage (ao vivo)", () => {
  const base = (process.env.SUPABASE_URL ?? "").replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  it("listagem autenticada do bucket traz os oito guias e os quatro currículos", async () => {
    const res = await fetch(`${base}/storage/v1/object/list/${PDF_BUCKET}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({ prefix: "", limit: 100, offset: 0 }),
      cache: "no-store",
    });
    expect(res.status).toBe(200);
    const itens = (await res.json()) as { name: string }[];
    const nomes = itens.map((i) => i.name).sort();
    expect(nomes).toEqual([...PDF_OBJECT_PATHS, ...CURRICULO_OBJECT_PATHS].sort());
  });

  it.each([...PDF_OBJECT_PATHS])("gera URL assinada que responde 200 em HEAD: %s", async (arquivo) => {
    const url = await createSignedPdfUrl(arquivo);
    expect(url.startsWith(`${base}/storage/v1/object/sign/${PDF_BUCKET}/${arquivo}?token=`)).toBe(true);
    const head = await fetch(url, { method: "HEAD", cache: "no-store" });
    expect(head.status).toBe(200);
    expect(head.headers.get("content-type")).toContain("pdf");
  });

  it.each([...CURRICULO_OBJECT_PATHS])("gera URL assinada que responde 200 em HEAD (.docx): %s", async (arquivo) => {
    const url = await createSignedPdfUrl(arquivo);
    expect(url.startsWith(`${base}/storage/v1/object/sign/${PDF_BUCKET}/${arquivo}?token=`)).toBe(true);
    const head = await fetch(url, { method: "HEAD", cache: "no-store" });
    expect(head.status).toBe(200);
  });

  it("recusa caminho fora da allowlist antes de qualquer chamada de rede", async () => {
    await expect(
      createSignedPdfUrl("../segredo.pdf" as unknown as (typeof PDF_OBJECT_PATHS)[number])
    ).rejects.toThrow("Caminho de PDF não permitido.");
  });
});
