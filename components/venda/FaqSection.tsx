"use client";

import { useState } from "react";
import { COMMON_FAQ, SUPPORT_EMAIL, type Area } from "@/lib/guias";

export default function FaqSection({ area }: { area: Area }) {
  const faq = [area.faq1, ...COMMON_FAQ];
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div
      id="faq"
      className="max-w-[1200px] mx-auto px-10 py-20 grid grid-cols-1 md:grid-cols-[340px_minmax(0,1fr)] gap-20"
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2.5 text-sm text-[#645950]">
          <span className="font-serif text-lg text-[#8C5E1E]">04</span>
          <span className="w-6 h-px bg-[#C9BBA8]" />
          <span>Perguntas frequentes</span>
        </div>
        <h2 className="m-0 font-serif font-normal text-[40px] leading-[1.1] tracking-[-.02em]">
          O que costumam perguntar
        </h2>
        <span className="text-base leading-[1.6] text-[#4A403A]">
          Outra dúvida?{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        </span>
      </div>

      <div className="flex flex-col border-t border-[#E2D8C9]">
        {faq.map(([q, a], i) => {
          const open = openIndex === i;
          return (
            <div key={q} className="border-b border-[#E2D8C9]">
              <button
                type="button"
                onClick={() => setOpenIndex(open ? null : i)}
                aria-expanded={open}
                className="w-full min-h-16 py-[18px] bg-transparent border-0 flex items-center justify-between gap-4 text-left text-lg font-medium text-[#2A2420] cursor-pointer"
              >
                <span className="flex flex-col gap-1">
                  {i === 0 && (
                    <span
                      className="text-xs tracking-[.08em] uppercase"
                      style={{ color: area.ct }}
                    >
                      {area.name}
                    </span>
                  )}
                  <span>{q}</span>
                </span>
                <span className="flex-none w-[30px] h-[30px] rounded-full border border-[#C9BBA8] flex items-center justify-center text-[#645950]">
                  {open ? "−" : "+"}
                </span>
              </button>
              {open && (
                <p className="m-0 pr-15 pb-[22px] text-[17px] leading-[1.65] text-[#4A403A]">
                  {a}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
