"use client";

import type { AnchorHTMLAttributes, MouseEvent } from "react";
import { track } from "@/lib/track";
import { useTrilha } from "./TrilhaProvider";

type CtaLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  area: string;
  posicao: "hero" | "header" | "closing";
};

export default function CtaLink({ area, posicao, onClick, children, ...rest }: CtaLinkProps) {
  const { trilha } = useTrilha();

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    track("click_cta", { area, trilha: trilha ?? undefined, posicao });
    onClick?.(e);
  };

  return (
    <a {...rest} onClick={handleClick}>
      {children}
    </a>
  );
}
