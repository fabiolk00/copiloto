/**
 * Acesso servidor ao bucket privado `pdfs` do Supabase Storage.
 *
 * Uso exclusivo de código de servidor (route handlers). O pacote `server-only`
 * não está instalado neste projeto e adicioná-lo exigiria nova dependência;
 * por isso a mesma garantia é aplicada em runtime pela guarda abaixo, que
 * lança se este módulo for avaliado num ambiente de navegador.
 *
 * A chave `SUPABASE_SERVICE_ROLE_KEY` é lida somente aqui, sem prefixo
 * NEXT_PUBLIC_. Nem a chave nem a URL assinada são registradas em log, e as
 * mensagens de erro não incluem corpo de resposta do gateway.
 */

if (typeof window !== "undefined") {
  throw new Error("lib/storage.ts é exclusivo do servidor.");
}

export const PDF_BUCKET = "pdfs";

/** Validade da URL assinada, em segundos. Curta de propósito: a URL é um bearer. */
export const SIGNED_URL_TTL_SECONDS = 300;

/**
 * Allowlist fechada dos objetos entregáveis. Qualquer caminho fora desta
 * lista é recusado antes de qualquer chamada de rede.
 */
export const PDF_OBJECT_PATHS = [
  "Guia-Carreira-Financeiro-Crescer-na-Empresa.pdf",
  "Guia-Carreira-Financeiro-Mudar-de-Empresa.pdf",
  "Guia-Carreira-Analise-de-Dados-Crescer-na-Empresa.pdf",
  "Guia-Carreira-Analise-de-Dados-Mudar-de-Empresa.pdf",
  "Guia-Carreira-Comercial-Crescer-na-Empresa.pdf",
  "Guia-Carreira-Comercial-Mudar-de-Empresa.pdf",
  "Guia-Carreira-Administrativo-Crescer-na-Empresa.pdf",
  "Guia-Carreira-Administrativo-Mudar-de-Empresa.pdf",
] as const;

export type PdfObjectPath = (typeof PDF_OBJECT_PATHS)[number];

const ALLOWED_PATHS: ReadonlySet<string> = new Set(PDF_OBJECT_PATHS);

/**
 * Gera uma URL assinada de curta duração para um PDF do bucket privado.
 * O caminho precisa estar na allowlist; nunca é montado a partir de entrada
 * do usuário.
 */
export async function createSignedPdfUrl(objectPath: PdfObjectPath): Promise<string> {
  if (!ALLOWED_PATHS.has(objectPath)) {
    throw new Error("Caminho de PDF não permitido.");
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  // Mensagens separadas para o log dizer qual variável falta (nunca o valor).
  if (!supabaseUrl) throw new Error("Storage não configurado: SUPABASE_URL ausente.");
  if (!serviceKey) throw new Error("Storage não configurado: SUPABASE_SERVICE_ROLE_KEY ausente.");

  const base = supabaseUrl.replace(/\/+$/, "");
  const res = await fetch(`${base}/storage/v1/object/sign/${PDF_BUCKET}/${objectPath}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ expiresIn: SIGNED_URL_TTL_SECONDS }),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Falha ao assinar o PDF (HTTP ${res.status}).`);
  }

  const data = (await res.json()) as { signedURL?: unknown };
  const signed = data.signedURL;
  if (typeof signed !== "string" || !signed.startsWith(`/object/sign/${PDF_BUCKET}/`)) {
    throw new Error("Resposta inesperada do Storage ao assinar o PDF.");
  }

  return `${base}/storage/v1${signed}`;
}
