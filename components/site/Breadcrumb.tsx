import Link from "next/link";

/** Breadcrumb visível (CON-07), coerente com o BreadcrumbList do JSON-LD: Início > página atual. */
export default function Breadcrumb({ atual }: { atual: string }) {
  return (
    <nav aria-label="Você está em" className="max-w-[1200px] mx-auto px-5 md:px-10 pt-0 md:pt-2 text-sm text-[#645950]">
      <ol className="m-0 p-0 list-none flex flex-wrap items-center gap-1.5">
        <li>
          <Link href="/" className="min-h-12 inline-flex items-center text-[#645950]">
            Início
          </Link>
        </li>
        <li aria-hidden="true">›</li>
        <li aria-current="page" className="text-[#2A2420]">
          {atual}
        </li>
      </ol>
    </nav>
  );
}
