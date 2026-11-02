import { BRAND_NAME, SUPPORT_EMAIL } from "@/lib/guias";

export default function Footer() {
  return (
    <footer className="bg-[#EDE4D6]">
      <div className="max-w-[1200px] mx-auto px-10 py-14 grid grid-cols-1 md:grid-cols-[1.4fr_1fr_auto] gap-14 items-start">
        <div className="flex flex-col gap-3.5">
          <span className="font-serif text-[22px]">{BRAND_NAME}</span>
          <p className="m-0 max-w-[460px] text-sm leading-[1.6] text-[#4A403A]">
            Material educativo de desenvolvimento profissional. Não constitui promessa de
            resultado, cargo ou salário.
          </p>
          <span className="text-[13px] text-[#645950]">
            © 2026 {BRAND_NAME} · CNPJ [inserir]
          </span>
        </div>

        <div className="flex flex-col gap-1 text-[15px]">
          <span className="text-[#645950]">Suporte</span>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="min-h-11 flex items-center text-[#2A2420]">
            {SUPPORT_EMAIL}
          </a>
        </div>

        <div className="flex gap-6 text-[15px]">
          <a href="#" className="min-h-11 flex items-center text-[#2A2420]">
            Termos de uso
          </a>
          <a href="#" className="min-h-11 flex items-center text-[#2A2420]">
            Privacidade
          </a>
        </div>
      </div>
    </footer>
  );
}
