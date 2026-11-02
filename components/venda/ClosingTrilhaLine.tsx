"use client";

import type { Area } from "@/lib/guias";
import { useTrilha } from "./TrilhaProvider";

export default function ClosingTrilhaLine({ area }: { area: Area }) {
  const { trilha } = useTrilha();

  const text =
    trilha === "crescer"
      ? "Sua trilha: crescer onde está. A etapa III leva você até a conversa de carreira com a sua liderança."
      : trilha === "mudar"
        ? "Sua trilha: mudar de empresa. A etapa III prepara currículo, entrevistas e a escolha da próxima vaga."
        : "Ainda não sabe se quer crescer onde está ou mudar de empresa? Tudo bem. As duas trilhas estão no guia.";

  return (
    <p
      className="m-0 px-[18px] py-4 rounded-2xl text-base leading-[1.55] text-[#2A2420]"
      style={{ background: area.tint }}
    >
      {text}
    </p>
  );
}
