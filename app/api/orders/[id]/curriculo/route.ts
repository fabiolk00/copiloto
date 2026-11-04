import { NextRequest, NextResponse } from "next/server";
import { getEntregaCurriculoUrl } from "@/lib/entrega";
import { enforceIpRateLimit } from "@/lib/request-guards";

// Destino do link do modelo de currículo ATS no e-mail. Mesmas garantias da
// rota do guia: valida pago, assina a URL no clique (300 s) e redireciona.
// Pedido inexistente e pedido não pago recebem a MESMA resposta (sem
// enumeração). Nunca cacheia e nunca vaza a origem pelo Referer. Não depende
// da trilha: o currículo acompanha o guia nas duas.
const HEADERS = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };

function naoDisponivel(status: number, error: string) {
  return NextResponse.json({ error }, { status, headers: HEADERS });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = enforceIpRateLimit(req, { keyPrefix: "curriculo", limit: 30, windowMs: 60_000 });
  if (limited) return limited;

  const { id: clientToken } = await params;

  let result;
  try {
    result = await getEntregaCurriculoUrl(clientToken);
  } catch (err) {
    console.error("[curriculo] falha ao gerar entrega", err instanceof Error ? err.message : "erro desconhecido");
    return naoDisponivel(503, "Não foi possível preparar o currículo agora. Tente novamente em instantes.");
  }

  if (!result.ok) {
    if (result.reason === "pedido_nao_encontrado" || result.reason === "pagamento_pendente") {
      return naoDisponivel(404, "Currículo não encontrado.");
    }
    return naoDisponivel(409, "Currículo indisponível para este pedido.");
  }

  return new NextResponse(null, { status: 302, headers: { ...HEADERS, Location: result.url } });
}
