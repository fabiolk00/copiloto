import type { Metadata } from "next";
import Link from "next/link";
import LogoSimbolo from "@/components/LogoSimbolo";
import { BRAND_NAME, SUPPORT_EMAIL, getAreaBySlug } from "@/lib/guias";

export const metadata: Metadata = {
  title: `Pagamento confirmado — ${BRAND_NAME}`,
  robots: { index: false, follow: false },
};

const PASSOS: [string, string][] = [
  ["Abra o seu e-mail", `Procure por “${BRAND_NAME}”.`],
  ["Baixe o PDF", "Use o link do e-mail para baixar o PDF e ler no celular."],
  ["Comece pela parte I", "As duas primeiras semanas são curtas e já mostram resultado."],
];

function primeiro(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** Só mostra o e-mail se parecer um e-mail; a URL é apenas exibição e nunca libera nada. */
function emailExibivel(v: string | undefined): string | null {
  if (!v || v.length > 254) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : null;
}

export default async function ObrigadoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const area = getAreaBySlug(primeiro(sp.area) ?? "") ?? getAreaBySlug("financeiro")!;
  const email = emailExibivel(primeiro(sp.email));
  const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Não recebi meu guia")}`;

  return (
    <>
      <header className="border-b border-[#E6DCCD] bg-[#F5EFE6]">
        <div className="max-w-[1200px] mx-auto h-14 md:h-[72px] px-5 md:px-10 flex items-center">
          <Link href="/" className="flex items-center gap-[9px] text-[#2A2420] no-underline">
            <LogoSimbolo size={22} />
            <span className="font-serif text-[17px] md:text-[19px] tracking-[-0.015em] whitespace-nowrap">
              {BRAND_NAME}
            </span>
          </Link>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto w-full px-5 md:px-10 pt-7 pb-8 md:pt-[88px] md:pb-24 grid grid-cols-1 md:grid-cols-[1.1fr_1fr] gap-5 md:gap-20 items-start">
        <div className="flex flex-col gap-5 md:gap-6">
          <span
            className="self-start inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs tracking-[.1em] uppercase font-semibold"
            style={{ background: area.tint, color: area.ct }}
          >
            ✓ Pagamento confirmado
          </span>
          <h1 className="m-0 font-serif font-normal text-[30px] md:text-[52px] leading-[1.1] tracking-[-.02em] text-balance">
            Seu guia está a caminho do seu e-mail.
          </h1>
          <p className="m-0 text-[15px] md:text-lg leading-[1.55] text-[#4A403A]">
            Enviamos o PDF de <strong>{area.name}</strong> para{" "}
            <strong>{email ?? "o e-mail informado na compra"}</strong>. Costuma chegar em até 5 minutos.
          </p>

          <div className="rounded-[14px] border-2 border-[#8C5E1E] bg-[#FBF8F2] p-4 md:p-5 flex flex-col gap-2">
            <span className="text-xs tracking-[.1em] uppercase font-semibold text-[#8C5E1E]">
              Não achou? Confira o spam
            </span>
            <p className="m-0 text-[15px] md:text-[17px] leading-[1.55] text-[#3A322D]">
              Olhe nas pastas <strong>Spam</strong>, <strong>Lixo eletrônico</strong> e, no Gmail, na aba{" "}
              <strong>Promoções</strong>. Se estiver lá, marque como “não é spam”.
            </p>
          </div>
        </div>

        <section
          aria-labelledby="proximos-passos"
          className="flex flex-col gap-5 md:rounded-3xl md:border md:border-[#E2D8C9] md:bg-[#FBF8F2] md:p-8"
        >
          <h2 id="proximos-passos" className="m-0 font-serif font-normal text-[22px] md:text-2xl">
            Próximos passos
          </h2>
          <ol className="m-0 p-0 list-none flex flex-col gap-4">
            {PASSOS.map(([titulo, desc], i) => (
              <li key={titulo} className="grid grid-cols-[32px_minmax(0,1fr)] md:grid-cols-[40px_minmax(0,1fr)] gap-3">
                <span
                  className="w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center font-serif text-base text-[#FBF8F2]"
                  style={{ background: area.ct }}
                >
                  {i + 1}
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-base md:text-[17px] font-semibold">{titulo}</span>
                  <span className="text-sm leading-[1.5] text-[#4A403A]">{desc}</span>
                </span>
              </li>
            ))}
          </ol>

          <div className="rounded-[14px] bg-[#EDE4D6] p-4 flex flex-col gap-1">
            <span className="text-[15px] font-semibold">Passou de 15 minutos e nada?</span>
            <a href={mailto} className="text-sm break-all">
              {SUPPORT_EMAIL}
            </a>
          </div>
          <a
            href={mailto}
            className="min-h-12 rounded-xl border-[1.5px] border-[#2A2420] text-[#2A2420] no-underline text-base font-semibold flex items-center justify-center"
          >
            Falar com o suporte
          </a>
        </section>
      </main>
    </>
  );
}
