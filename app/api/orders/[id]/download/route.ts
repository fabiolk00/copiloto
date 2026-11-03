import { NextRequest, NextResponse } from "next/server";
import { getEntregaPdfUrl } from "@/lib/entrega";
import { enforceIpRateLimit } from "@/lib/request-guards";

// `id` é o client_token gerado no navegador (ver app/api/orders/[id]/status).
// Esta rota não devolve o PDF: devolve uma URL assinada de 300 s, e só para
// pedido com status pago. Resposta sem cache.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = enforceIpRateLimit(req, { keyPrefix: "download", limit: 30, windowMs: 60_000 });
  if (limited) return limited;

  const { id: clientToken } = await params;

  let result;
  try {
    result = await getEntregaPdfUrl(clientToken);
  } catch (err) {
    // Só o motivo textual, sem URL, chave ou objeto de erro completo.
    console.error("[download] falha ao gerar entrega", err instanceof Error ? err.message : "erro desconhecido");
    return NextResponse.json(
      { error: "Não foi possível preparar o guia agora. Tente novamente em instantes." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  const noStore = { "Cache-Control": "no-store" };

  if (!result.ok) {
    switch (result.reason) {
      case "pedido_nao_encontrado":
        return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404, headers: noStore });
      case "pagamento_pendente":
        return NextResponse.json({ error: "Pagamento ainda não confirmado." }, { status: 402, headers: noStore });
      case "trilha_ausente":
        return NextResponse.json({ error: "Pedido sem trilha definida." }, { status: 409, headers: noStore });
      case "guia_sem_arquivo":
        return NextResponse.json({ error: "Guia indisponível para este pedido." }, { status: 409, headers: noStore });
    }
  }

  return NextResponse.json({ url: result.url, expiresIn: result.expiresIn }, { status: 200, headers: noStore });
}
