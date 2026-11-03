import { NextRequest, NextResponse } from "next/server";
import { getEntregaPdfUrl } from "@/lib/entrega";
import { enforceIpRateLimit } from "@/lib/request-guards";

// Destino do link do e-mail. Valida pago, assina a URL no clique (300 s) e
// redireciona. Pedido inexistente e pedido não pago recebem a MESMA resposta
// (sem enumeração). Nunca cacheia e nunca vaza a origem pelo Referer.
const HEADERS = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };

function naoDisponivel(status: number, error: string) {
  return NextResponse.json({ error }, { status, headers: HEADERS });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = enforceIpRateLimit(req, { keyPrefix: "guia", limit: 30, windowMs: 60_000 });
  if (limited) return limited;

  const { id: clientToken } = await params;

  let result;
  try {
    result = await getEntregaPdfUrl(clientToken);
  } catch (err) {
    console.error("[guia] falha ao gerar entrega", err instanceof Error ? err.message : "erro desconhecido");
    return naoDisponivel(503, "Não foi possível preparar o guia agora. Tente novamente em instantes.");
  }

  if (!result.ok) {
    if (result.reason === "pedido_nao_encontrado" || result.reason === "pagamento_pendente") {
      return naoDisponivel(404, "Guia não encontrado.");
    }
    return naoDisponivel(409, "Guia indisponível para este pedido.");
  }

  return new NextResponse(null, { status: 302, headers: { ...HEADERS, Location: result.url } });
}
