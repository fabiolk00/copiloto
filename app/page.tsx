import type { Metadata } from "next";
import { BRAND_NAME, COMMON_FAQ } from "@/lib/guias";
import LogoSimbolo from "@/components/LogoSimbolo";
import { JsonLd } from "@/components/seo/JsonLd";
import GuiasCards from "@/components/site/GuiasCards";
import { CARD_LISTA, DEPOIMENTOS, DepoimentoCard } from "@/components/venda/BonusAndTestimonials";
import { SEO_DESCRIPTION_HOME, SEO_TITLE_HOME, organizationLd, pageMetadata, websiteLd } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: SEO_TITLE_HOME,
  description: SEO_DESCRIPTION_HOME,
  path: "/",
});

const PASSOS: [string, string][] = [
  ["Diagnóstico", "Descubra onde você está hoje."],
  ["Etapas semanais", "Uma ação por semana, em 8 semanas."],
  ["Prompts de IA", "Modelos prontos para copiar e usar."],
];

/** Itens presentes em todos os guias (lib/guias: gives, GUARANTEES e CurriculoCard). */
const INCLUSO = [
  "PDF da sua profissão, com sumário clicável",
  "Plano em 3 partes com etapas semanais e exercícios",
  "Prompts de IA prontos para a rotina",
  "Roteiro para a conversa de carreira com a liderança",
  "Modelo de currículo ATS (.docx) com prompt para adaptar a cada vaga",
];

/** Respostas extraídas do FAQ real das páginas de guia (COMMON_FAQ), sem promessas novas. */
const faqComum = (pergunta: string) => {
  const item = COMMON_FAQ.find(([q]) => q === pergunta);
  if (!item) throw new Error(`Pergunta ausente em COMMON_FAQ: ${pergunta}`);
  return item[1];
};

const FAQ_HOME: [string, string][] = [
  [
    `O que é o ${BRAND_NAME}?`,
    "Guias digitais em PDF por profissão, com etapas semanais e prompts de IA prontos para aplicar.",
  ],
  ["Como recebo o guia?", "Por e-mail, logo após a confirmação do pagamento. O acesso ao PDF é permanente."],
  ["Preciso saber usar IA?", "Não. Os prompts são prontos: você copia, cola e ajusta ao seu caso."],
  ["Preciso pagar alguma ferramenta de IA?", faqComum("Preciso pagar por alguma ferramenta de IA?")],
  [
    "Qual guia escolher?",
    "O da área em que você trabalha hoje. Se atua em mais de uma, comece pela que ocupa a maior parte da sua semana.",
  ],
];

const H2 = "m-0 font-serif font-normal text-[24px] md:text-[34px] leading-[1.15] tracking-[-.015em]";
const SECAO = "w-full max-w-[760px] mx-auto px-5 md:px-10 py-8 md:py-12 flex flex-col gap-4";

export default function Home() {
  const depoimentos = DEPOIMENTOS.filter((d) => d.confirmado);
  const visiveis = depoimentos.slice(0, 2);
  const restantes = depoimentos.slice(2);

  return (
    <>
      <JsonLd data={[organizationLd(), websiteLd()]} />
      <main className="flex-1 text-[#2A2420]">
        <header className="w-full max-w-[760px] mx-auto px-5 md:px-10 pt-10 md:pt-20 pb-6 flex flex-col gap-5">
          <span className="inline-flex items-center gap-2.5">
            <LogoSimbolo size={28} />
            <span className="font-serif text-lg tracking-[-0.015em]">{BRAND_NAME}</span>
          </span>
          <h1 className="m-0 font-serif font-normal text-[32px] md:text-[52px] leading-[1.08] tracking-[-.02em] text-balance">
            Guias de carreira em PDF com prompts de IA
          </h1>
          <p className="m-0 text-base md:text-lg leading-[1.55] text-[#4A403A]">
            Um caminho de 8 semanas para a sua área, com prompts de IA prontos. Pagamento único de R$&nbsp;29,90.
          </p>
          <a
            href="#guias"
            className="self-start min-h-12 px-6 rounded-xl bg-[#8C5E1E] text-[#FBF8F2] no-underline text-base font-semibold flex items-center justify-center hover:bg-[#6F4914] hover:text-[#FBF8F2]"
          >
            Escolher meu guia
          </a>
        </header>

        <section id="guias" aria-labelledby="guias-titulo" className={`${SECAO} scroll-mt-4`}>
          <h2 id="guias-titulo" className={H2}>
            Escolha o guia da sua área
          </h2>
          <GuiasCards />
        </section>

        <section aria-labelledby="como-titulo" className={SECAO}>
          <h2 id="como-titulo" className={H2}>
            Como funciona
          </h2>
          <ol className="m-0 p-0 list-none grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {PASSOS.map(([titulo, texto], i) => (
              <li key={titulo} className="rounded-xl border border-[#E2D8C9] bg-[#FBF8F2] px-4 py-3.5 flex flex-col gap-1">
                <span className="text-xs tracking-[.08em] uppercase text-[#8C5E1E]">Passo {i + 1}</span>
                <strong className="text-base font-semibold">{titulo}</strong>
                <span className="text-[15px] leading-[1.4] text-[#645950]">{texto}</span>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="incluso-titulo" className={SECAO}>
          <h2 id="incluso-titulo" className={H2}>
            O que você recebe
          </h2>
          <details className="group rounded-xl border border-[#E2D8C9] bg-[#FBF8F2] px-4">
            <summary className="list-none [&::-webkit-details-marker]:hidden min-h-12 flex items-center justify-between gap-3 font-semibold cursor-pointer">
              Ver o que está incluso
              <span aria-hidden="true">
                <span className="group-open:hidden">+</span>
                <span className="hidden group-open:inline">−</span>
              </span>
            </summary>
            <ul className="m-0 pl-5 pb-4 flex flex-col gap-2 text-[15px] leading-[1.5] text-[#3A322D]">
              {INCLUSO.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </details>
        </section>

        <section aria-labelledby="para-quem-titulo" className={SECAO}>
          <h2 id="para-quem-titulo" className={H2}>
            Para quem é
          </h2>
          <p className="m-0 text-base leading-[1.55] text-[#4A403A]">
            Para quem quer uma rotina mais clara e um próximo passo de carreira. Não é fórmula pronta de resultado.
          </p>
        </section>

        <section aria-labelledby="relatos-titulo" className={SECAO}>
          <h2 id="relatos-titulo" className={H2}>
            Mensagens de quem já usou
          </h2>
          <div className="flex flex-col gap-3">
            {visiveis.map((d) => (
              <DepoimentoCard key={d.tipo === "imagem" ? d.src : d.nome} d={d} className={CARD_LISTA} sizes="(max-width: 767px) 92vw, 680px" />
            ))}
          </div>
          {restantes.length > 0 && (
            <details className="group">
              <summary className="list-none [&::-webkit-details-marker]:hidden min-h-12 flex items-center font-semibold text-[#8C5E1E] cursor-pointer">
                <span className="group-open:hidden">Ver mais mensagens</span>
                <span className="hidden group-open:inline">Ver menos</span>
              </summary>
              <div className="flex flex-col gap-3">
                {restantes.map((d) => (
                  <DepoimentoCard key={d.tipo === "imagem" ? d.src : d.nome} d={d} className={CARD_LISTA} sizes="(max-width: 767px) 92vw, 680px" />
                ))}
              </div>
            </details>
          )}
        </section>

        <section aria-labelledby="faq-titulo" className={SECAO}>
          <h2 id="faq-titulo" className={H2}>
            Perguntas frequentes
          </h2>
          <div className="flex flex-col border-t border-[#E2D8C9]">
            {FAQ_HOME.map(([q, a]) => (
              <details key={q} className="group border-b border-[#E2D8C9]">
                <summary className="list-none [&::-webkit-details-marker]:hidden min-h-12 py-3 flex items-center justify-between gap-4 text-base font-medium cursor-pointer">
                  {q}
                  <span aria-hidden="true" className="flex-none text-[#645950]">
                    <span className="group-open:hidden">+</span>
                    <span className="hidden group-open:inline">−</span>
                  </span>
                </summary>
                <p className="m-0 pb-4 text-base leading-[1.5] text-[#4A403A]">{a}</p>
              </details>
            ))}
          </div>
        </section>

        <section aria-labelledby="fechamento-titulo" className={`${SECAO} pb-14 md:pb-20`}>
          <h2 id="fechamento-titulo" className={H2}>
            Comece pelo guia da sua área
          </h2>
          <a
            href="#guias"
            className="self-start min-h-12 px-6 rounded-xl bg-[#8C5E1E] text-[#FBF8F2] no-underline text-base font-semibold flex items-center justify-center hover:bg-[#6F4914] hover:text-[#FBF8F2]"
          >
            Escolher meu guia
          </a>
        </section>
      </main>
    </>
  );
}
