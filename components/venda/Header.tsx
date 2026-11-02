"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BRAND_NAME } from "@/lib/guias";

const NAV_ITEMS = [
  { id: "guia", num: "01", label: "O guia" },
  { id: "caminho", num: "02", label: "O caminho" },
  { id: "ia", num: "✦", label: "IA" },
  { id: "faq", num: "04", label: "Perguntas" },
];

export default function Header() {
  const [progress, setProgress] = useState(0);
  const [activeSection, setActiveSection] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const scrollTop = window.scrollY;

      let section = "";
      for (const { id } of NAV_ITEMS) {
        const el = document.getElementById(id);
        if (el && el.offsetTop - 140 <= scrollTop) section = id;
      }

      setProgress(max > 0 ? scrollTop / max : 0);
      setActiveSection(section);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <header className="sticky top-0 z-10 bg-[#F5EFE6]/94 backdrop-blur-[8px] border-b border-[#E6DCCD]">
      <div className="max-w-[1200px] mx-auto h-[72px] px-10 flex items-center justify-between gap-6">
        <Link href="/" className="flex items-center gap-2.5 text-[#2A2420] no-underline">
          <span className="w-6 h-6 rounded-full border-[1.5px] border-[#2A2420] flex items-center justify-center">
            <span className="w-1.5 h-1.5 rounded-full bg-[#8C5E1E]" />
          </span>
          <span className="font-serif text-[22px]">{BRAND_NAME}</span>
        </Link>

        <nav className="hidden md:flex gap-7 text-[15px]">
          {NAV_ITEMS.map(({ id, num, label }) => (
            <a
              key={id}
              href={`#${id}`}
              className="min-h-11 flex items-center gap-1.5 no-underline"
              style={{ color: activeSection === id ? "#2A2420" : "#645950" }}
            >
              <span className="font-serif text-[#8C5E1E]">{num}</span>
              {label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-1">
          <a
            href="#fechamento"
            className="min-h-10 px-[18px] rounded-xl bg-[#8C5E1E] text-[#FBF8F2] no-underline text-[15px] font-semibold flex items-center hover:bg-[#6F4914] hover:text-[#FBF8F2]"
          >
            Quero o guia
          </a>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-label="Abrir navegação"
            className="md:hidden w-11 h-11 border-0 bg-transparent cursor-pointer flex flex-col items-center justify-center gap-[5px]"
          >
            <span className="w-[18px] h-[1.5px] bg-[#2A2420]" />
            <span className="w-[18px] h-[1.5px] bg-[#2A2420]" />
            <span className="w-3 h-[1.5px] bg-[#2A2420] self-center -ml-1.5" />
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="md:hidden px-5 pt-1 pb-4 flex flex-col border-t border-[#E6DCCD]">
          {NAV_ITEMS.map(({ id, num, label }) => {
            const current = activeSection === id;
            return (
              <a
                key={id}
                href={`#${id}`}
                onClick={() => setMenuOpen(false)}
                aria-current={current}
                className="min-h-12 flex items-center gap-3 no-underline text-[#2A2420] text-[17px] border-b border-[#EDE4D6]"
                style={{ fontWeight: current ? 600 : 400 }}
              >
                <span className="w-7 font-serif text-[15px] text-[#645950]">{num}</span>
                <span className="flex-1">{label}</span>
                <span
                  className="w-2 h-2 rounded-full border-[1.5px] border-[#8C5E1E]"
                  style={{ background: current ? "#8C5E1E" : "transparent" }}
                />
              </a>
            );
          })}
        </nav>
      )}

      <div className="h-0.5 bg-[#E6DCCD]">
        <div
          className="h-0.5 bg-[#8C5E1E] transition-[width] duration-150"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </header>
  );
}
