import { getPedidoEntregaByClientToken } from "@/lib/pedidos";
import {
  createSignedPdfUrl,
  SIGNED_URL_TTL_SECONDS,
  type CurriculoObjectPath,
  type PdfObjectPath,
} from "@/lib/storage";
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
  ["administrativo:crescer", "Guia-Carreira-Administrativo-Crescer-na-Empresa.pdf"],
  ["administrativo:mudar", "Guia-Carreira-Administrativo-Mudar-de-Empresa.pdf"],
  ["customer-success:crescer", "Guia-Carreira-Customer-Success-Crescer-na-Empresa.pdf"],
  ["customer-success:mudar", "Guia-Carreira-Customer-Success-Mudar-de-Empresa.pdf"],
  ["marketing:crescer", "Guia-Carreira-Marketing-Crescer-na-Empresa.pdf"],
  ["marketing:mudar", "Guia-Carreira-Marketing-Mudar-de-Empresa.pdf"],
]);

/**
 * Área -> modelo de currículo ATS. Só a área decide: o mesmo arquivo acompanha
 * o guia nas duas trilhas (crescer e mudar).
 */
const CURRICULO_POR_AREA = new Map<string, CurriculoObjectPath>([
  ["financeiro", "Curriculo-ATS-Financeiro-Mudar-de-Empresa.docx"],
  ["analise-de-dados", "Curriculo-ATS-Analise-de-Dados-Mudar-de-Empresa.docx"],
  ["comercial", "Curriculo-ATS-Comercial-Mudar-de-Empresa.docx"],
  ["administrativo", "Curriculo-ATS-Administrativo-Mudar-de-Empresa.docx"],
  ["customer-success", "Curriculo-ATS-Customer-Success-Mudar-de-Empresa.docx"],
  ["marketing", "Curriculo-ATS-Marketing-Mudar-de-Empresa.docx"],
]);

/** Devolve o modelo de currículo da área (independente da trilha), ou `null` se a área não existir. */
export function resolveCurriculoDocx(areaSlug: string): CurriculoObjectPath | null {
  return CURRICULO_POR_AREA.get(areaSlug) ?? null;
}

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

/**
 * Entrega a URL assinada do modelo de currículo ATS da área, também só para
 * pedido pago. Não exige trilha: o currículo acompanha o guia nas duas.
 */
export async function getEntregaCurriculoUrl(clientToken: string): Promise<EntregaResult> {
  const pedido = await getPedidoEntregaByClientToken(clientToken);
  if (!pedido) return { ok: false, reason: "pedido_nao_encontrado" };
  if (pedido.status !== "pago") return { ok: false, reason: "pagamento_pendente" };

  const objectPath = resolveCurriculoDocx(pedido.area_slug);
  if (!objectPath) return { ok: false, reason: "guia_sem_arquivo" };

  const url = await createSignedPdfUrl(objectPath);
  return { ok: true, url, expiresIn: SIGNED_URL_TTL_SECONDS };
}
