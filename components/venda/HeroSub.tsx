"use client";

import type { Area } from "@/lib/guias";
import { useTrilha } from "./TrilhaProvider";

export default function HeroSub({ area }: { area: Area }) {
  const { trilha } = useTrilha();
  const text = trilha ? area.heroSub[trilha] : area.sub;

  return (
    <p className="m-0 max-w-[580px] text-xl leading-[1.6] text-[#4A403A] text-pretty">{text}</p>
  );
}
