import { getPedidoEntregaByClientToken } from "@/lib/pedidos";
import { createSignedPdfUrl, SIGNED_URL_TTL_SECONDS, type PdfObjectPath } from "@/lib/storage";
import type { Trilha } from "@/lib/guias";

/**
 * Mapeamento fechado (área, trilha) -> arquivo do bucket. Os slugs de área
 * vêm de lib/guias.ts. Entradas fora deste mapa são recusadas.
 */
const PDF_POR_AREA_TRILHA = new Map<string, PdfObjectPath>([
  ["financeiro:crescer", "Guia-Carreira-Financeiro-Crescer-na-Empresa.pdf"],
  ["financeiro:mudar", "Guia-Carreira-Financeiro-Mudar-de-Empresa.pdf"],
  ["analise-de-dados:crescer", "Guia-Carreira-Analise-de-Dados-Crescer-na-Empresa.pdf"],
  ["analise-de-dados:mudar", "Guia-Carreira-Analise-de-Dados-Mudar-de-Empresa.pdf"],
  ["comercial:crescer", "Guia-Carreira-Comercial-Crescer-na-Empresa.pdf"],
  ["comercial:mudar", "Guia-Carreira-Comercial-Mudar-de-Empresa.pdf"],
]);

/** Devolve o arquivo do guia para a área e trilha, ou `null` se não houver correspondência. */
export function resolveGuiaPdf(areaSlug: string, trilha: Trilha | string | null): PdfObjectPath | null {
  if (!trilha) return null;
  return PDF_POR_AREA_TRILHA.get(`${areaSlug}:${trilha}`) ?? null;
}

export type EntregaResult =
  | { ok: true; url: string; expiresIn: number }
  | { ok: false; reason: "pedido_nao_encontrado" | "pagamento_pendente" | "trilha_ausente" | "guia_sem_arquivo" };

/**
 * Entrega a URL assinada do guia só para pedido pago. O estado é lido no
 * servidor a partir do client_token; nada do cliente decide área, trilha ou
 * status.
 */
export async function getEntregaPdfUrl(clientToken: string): Promise<EntregaResult> {
  const pedido = await getPedidoEntregaByClientToken(clientToken);
  if (!pedido) return { ok: false, reason: "pedido_nao_encontrado" };
  if (pedido.status !== "pago") return { ok: false, reason: "pagamento_pendente" };
  if (!pedido.trilha) return { ok: false, reason: "trilha_ausente" };

  const objectPath = resolveGuiaPdf(pedido.area_slug, pedido.trilha);
  if (!objectPath) return { ok: false, reason: "guia_sem_arquivo" };

  const url = await createSignedPdfUrl(objectPath);
  return { ok: true, url, expiresIn: SIGNED_URL_TTL_SECONDS };
}
