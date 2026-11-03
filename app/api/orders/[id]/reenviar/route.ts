import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { solicitarReenvio } from "@/lib/email-queue";
import { enforceIpRateLimit } from "@/lib/request-guards";

const NO_STORE = { "Cache-Control": "no-store" };
// O token vem da rota; o destinatário NUNCA vem da requisição (é o payer_email gravado).
const tokenSchema = z.string().uuid();

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Paliativo por IP (em memória, por instância). Os limites que valem — 3
  // reenvios e 2 min entre eles — são garantidos no banco, em um único UPDATE.
  const limited = enforceIpRateLimit(req, { keyPrefix: "reenviar", limit: 10, windowMs: 60_000 });
  if (limited) return limited;

  const { id } = await params;
  const token = tokenSchema.safeParse(id);
  // Mesma resposta de "inexistente" para token malformado.
  if (!token.success) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404, headers: NO_STORE });

  try {
    const r = await solicitarReenvio(token.data);
    switch (r.tipo) {
      case "enfileirado":
      case "em_andamento":
        return NextResponse.json({ ok: true }, { status: 202, headers: NO_STORE });
      case "nao_encontrado":
        return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404, headers: NO_STORE });
      case "rejeitado":
        return NextResponse.json(
          { error: "Não conseguimos entregar neste e-mail. Use o botão de baixar o guia." },
          { status: 409, headers: NO_STORE }
        );
      case "limite":
        return NextResponse.json(
          { error: "Limite de reenvios atingido. Use o botão de baixar o guia." },
          { status: 429, headers: NO_STORE }
        );
      case "aguarde":
        return NextResponse.json(
          { error: "Aguarde um pouco antes de pedir outro reenvio." },
          { status: 429, headers: { ...NO_STORE, "Retry-After": String(r.segundos) } }
        );
    }
  } catch (err) {
    console.error("[reenviar] falha", err instanceof Error ? err.message : "erro desconhecido");
    return NextResponse.json({ error: "Não foi possível reenviar agora." }, { status: 503, headers: NO_STORE });
  }
}
