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

        <a
          href="#fechamento"
          className="min-h-11 px-[18px] rounded-xl bg-[#8C5E1E] text-[#FBF8F2] no-underline text-[15px] font-semibold flex items-center hover:bg-[#6F4914] hover:text-[#FBF8F2]"
        >
          Quero o guia
        </a>
      </div>
      <div className="h-0.5 bg-[#E6DCCD]">
        <div
          className="h-0.5 bg-[#8C5E1E] transition-[width] duration-150"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </header>
  );
}
