import Image from "next/image";
import { BRAND_NAME } from "@/lib/guias";

export type DepoimentoImagem = {
  tipo: "imagem";
  src: string;
  largura: number;
  altura: number;
  alt: string;
  legenda: string;
  /** Só aparece na página com `true`. */
  confirmado: boolean;
};

export type DepoimentoTexto = {
  tipo: "texto";
  titulo: string;
  texto: string;
  nome: string;
  cargo: string;
  avatar: { src: string; alt: string };
  confirmado: boolean;
};

/** Depoimentos exibidos, na ordem. `confirmado: true` esconde um item sem apagá-lo. */
export const DEPOIMENTOS: (DepoimentoImagem | DepoimentoTexto)[] = [
  {
    tipo: "imagem",
    src: "/depoimentos/eder.png",
    largura: 412,
    altura: 183,
    alt: "Mensagem: comprei o guia de Análise de Dados (mudar de empresa), usei o modelo de currículo com as diretrizes de IA e consegui 2 contatos com recrutadores",
    legenda: "Mensagem recebida · nome e foto ocultados",
    confirmado: true,
  },
  {
    tipo: "imagem",
    src: "/depoimentos/felipe.png",
    largura: 428,
    altura: 220,
    alt: "Mensagem de Felipe Piva: conseguiu 3 novas entrevistas depois de seguir o passo a passo do site.",
    legenda: "Mensagem recebida · Felipe Piva",
    confirmado: true,
  },
  {
    tipo: "texto",
    titulo: "Fui escolhido para uma vaga interna",
    texto:
      "Eu não entendia por que não avançava nas vagas internas da minha empresa. Depois que o Copiloto Carreira ajustou meu currículo, comecei a chamar atenção em processos internos e externos. Me candidatei a uma vaga interna e fui escolhido.",
    nome: "Matheus Bólico",
    cargo: "Cientista de Dados",
    avatar: { src: "/depoimentos/matheus.png", alt: "Foto de Matheus Bólico" },
    confirmado: true,
  },
  {
    tipo: "imagem",
    src: "/depoimentos/mensagem-curriculo.png",
    largura: 421,
    altura: 235,
    alt: "Mensagem de uma pessoa (nome e foto ocultados): depois de reestruturar o currículo, percebeu mais visibilidade e recrutadores entrando em contato.",
    legenda: "Mensagem recebida · nome e foto ocultados",
    confirmado: true,
  },
  {
    tipo: "imagem",
    src: "/depoimentos/mensagem-linkedin.png",
    largura: 419,
    altura: 98,
    alt: "Mensagem de uma pessoa (nome e foto ocultados): a pontuação no LinkedIn melhorou e chegou a 83.",
    legenda: "Mensagem recebida · nome e foto ocultados",
    confirmado: true,
  },
];

const CARD_BASE = "bg-[#FBF8F2] border border-[#E2D8C9] rounded-[20px]";
const CARD = `flex-none w-[300px] snap-start md:w-auto md:flex-[1_1_300px] max-w-[520px] ${CARD_BASE}`;

/** Um depoimento (print ou texto). `className` define a largura no contêiner (carrossel ou lista). */
export function DepoimentoCard({
  d,
  className = CARD,
  sizes = "(max-width: 767px) 300px, 520px",
}: {
  d: DepoimentoImagem | DepoimentoTexto;
  className?: string;
  sizes?: string;
}) {
  return d.tipo === "imagem" ? (
    <figure className={`${className} m-0 p-4 flex flex-col gap-2.5`}>
      <Image
        src={d.src}
        width={d.largura}
        height={d.altura}
        alt={d.alt}
        sizes={sizes}
        className="w-full h-auto rounded-[10px] border border-[#EDE4D6] bg-white"
      />
      <figcaption className="text-[13px] text-[#645950]">{d.legenda}</figcaption>
    </figure>
  ) : (
    <figure className={`${className} m-0 p-5 md:p-6 flex flex-col gap-4`}>
      <blockquote className="m-0 flex flex-col gap-4">
        <p className="m-0 font-serif text-[19px] md:text-2xl leading-[1.25]">“{d.titulo}”</p>
        <p className="m-0 text-sm md:text-base leading-[1.5] md:leading-[1.55] text-[#4A403A]">{d.texto}</p>
      </blockquote>
      <figcaption className="flex items-center gap-3">
        <Image src={d.avatar.src} width={48} height={48} alt={d.avatar.alt} className="rounded-full" />
        <span className="flex flex-col">
          <span className="text-[15px] font-semibold">{d.nome}</span>
          <span className="text-sm text-[#645950]">{d.cargo}</span>
        </span>
      </figcaption>
    </figure>
  );
}

export const CARD_LISTA = `w-full ${CARD_BASE}`;

export default function BonusAndTestimonials() {
  const visiveis = DEPOIMENTOS.filter((d) => d.confirmado);

  return (
    <div className="max-w-[1200px] mx-auto md:px-10 py-8 md:pt-0 md:pb-20 border-t border-[#E6DCCD] md:border-0 grid grid-cols-1 gap-4 md:gap-6">
      <div className="px-5 md:px-0 flex flex-col gap-3.5">
        <div className="flex items-center justify-between gap-3"><span className="self-start inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#2F2925] text-[#F5EFE6] text-[11px] md:text-[13px] font-semibold tracking-[.12em] uppercase">
          <span aria-hidden="true" className="w-2 h-2 rounded-full bg-[#E0B97A]" />
          Relatos reais
        </span><span className="md:hidden text-xs text-[#645950]">{visiveis.length} mensagens</span></div>
        <h2 className="m-0 font-serif font-normal text-[26px] md:text-[32px] leading-[1.15] tracking-[-.015em] text-pretty">
          Mensagens de quem já usou o {BRAND_NAME}
        </h2>
      </div>

      <div className="no-scrollbar flex md:flex-wrap gap-3 md:gap-4 items-start overflow-x-auto md:overflow-visible snap-x snap-mandatory md:snap-none px-5 md:px-0 scroll-px-5">
        {visiveis.map((d) => (
          <DepoimentoCard key={d.tipo === "imagem" ? d.src : d.nome} d={d} />
        ))}
      </div>
    </div>
  );
}
