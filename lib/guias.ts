/** Reading track: grow in the current role, or move to a new company. Same product and price either way. */
export type Trilha = "crescer" | "mudar";

export type Area = {
  slug: string;
  name: string;
  roman: "I" | "II" | "III" | "IV";
  /** Accent color for this profession, used only in small details (dot, rail, labels). */
  c: string;
  /** Darker, text-safe variant of the accent color. */
  ct: string;
  /** Light tint of the accent color, used as a background. */
  tint: string;
  h1: string;
  sub: string;
  /** Hero subtitle per track, shown instead of `sub` once a track is selected. */
  heroSub: Record<Trilha, string>;
  bonus: string;
  bonusD: string;
  honestT: string;
  honest: string;
  gives: string[];
  /** The 3 parts of the guide's path, in order (I, II, III). */
  parts: string[];
  /** Part III branch per track: how that part plays out depending on the choice. Shown side by side, with the selected one highlighted. */
  parteIII: Record<Trilha, { titulo: string; desc: string }>;
  /** [title, body] pairs of ready-to-use AI prompts from the guide. */
  prompts: [string, string][];
  /** The profession-specific FAQ entry, shown first. */
  faq1: [string, string];
};

export const BRAND_NAME = "Copiloto Carreira";
export const SUPPORT_EMAIL = "fabio.kro@outlook.com";
/** Single fixed price for any guide/area, in BRL. Computed server-side only — never trust a price from the client. */
export const PRICE_BRL = 29.9;

export const TRILHAS: { id: Trilha; rotulo: string; descricao: string; curta: string }[] = [
  {
    id: "crescer",
    rotulo: "Quero crescer onde estou",
    descricao: "Levar o seu trabalho atual para o próximo nível, dentro da empresa onde já está.",
    curta: "Ganhar espaço na empresa atual.",
  },
  {
    id: "mudar",
    rotulo: "Quero mudar de empresa",
    descricao: "Preparar currículo, LinkedIn e entrevistas para se candidatar a novas vagas.",
    curta: "Preparar currículo e entrevistas.",
  },
];

export const AREAS: Area[] = [
  {
    slug: "financeiro",
    name: "Financeiro",
    roman: "I",
    c: "#5E6B3A",
    ct: "#4F5A30",
    tint: "#E8EADB",
    h1: "Do fechamento do mês para a mesa onde as decisões são tomadas.",
    sub: "Um guia em três partes para quem trabalha no financeiro e quer ser lembrado por mais do que o número que não bateu. Com prompts prontos para usar a IA nas tarefas que mais tomam o seu tempo.",
    heroSub: {
      crescer:
        "Um guia em três partes para quem quer crescer no financeiro dentro da empresa onde já está, com etapas semanais e prompts prontos para usar a IA nas tarefas que mais tomam o seu tempo.",
      mudar:
        "Um guia em três partes para quem quer se candidatar a novas vagas no financeiro, com etapas semanais e prompts prontos para organizar currículo, LinkedIn e entrevistas.",
    },
    bonus: "Mapa de competências do financeiro",
    bonusD: "Uma planilha simples para marcar onde você está hoje e escolher as duas habilidades que vale trabalhar primeiro.",
    honestT: "Este guia vai te ajudar a estar mais perto de uma promoção.",
    honest: "Ele não substitui experiência, nem muda a cultura da sua empresa. O que ele faz é organizar a sua próxima fase em etapas pequenas e mostrar onde a IA economiza horas que hoje vão para conciliação e planilha.",
    gives: [
      "Diagnóstico de onde você está hoje e para onde dá para crescer",
      "Três partes com etapas semanais curtas",
      "Páginas de reflexão e exercícios práticos",
      "Prompts prontos para conciliações, análises e apresentações",
      "Roteiro para a conversa de carreira com a sua liderança",
    ],
    parts: [
      "Entender por que o seu trabalho ainda é visto como operacional e mapear o que já sabe fazer.",
      "Liberar tempo da rotina com IA e escolher uma análise que gere decisão, não só relatório.",
      "Apresentar essa análise, abrir a conversa de carreira e definir os próximos seis meses.",
    ],
    parteIII: {
      crescer: {
        titulo: "Virar referência no time de finanças",
        desc: "Propor assumir uma análise recorrente para a diretoria e negociar o próximo nível com a sua liderança.",
      },
      mudar: {
        titulo: "Levar o que construiu para outra empresa",
        desc: "Traduzir suas entregas em currículo e LinkedIn, mirar vagas de FP&A ou controladoria e se preparar para entrevistas de caso.",
      },
    },
    prompts: [
      [
        "Explicar uma variação para a diretoria",
        "Atue como analista financeiro sênior. Vou colar a DRE deste mês e a do mês anterior. Identifique as 3 variações mais relevantes, explique as causas prováveis em linguagem simples e sugira uma pergunta que a diretoria deveria fazer sobre cada uma.\n\n[colar DRE]",
      ],
      [
        "Revisar uma conciliação",
        "Abaixo estão o extrato bancário e o razão da conta [nome da conta]. Liste os lançamentos que não batem, agrupe por tipo de divergência e sugira a ordem de verificação. Não invente valores: se faltar informação, pergunte.",
      ],
      [
        "Preparar a conversa de carreira",
        "Estou no financeiro há [tempo] como [cargo]. Quero propor assumir [responsabilidade]. Me ajude a montar 3 argumentos baseados em entregas concretas e antecipe 2 objeções que a minha liderança pode ter.",
      ],
    ],
    faq1: [
      "Serve para quem está começando no financeiro?",
      "Sim. As etapas partem de onde você está, seja assistente, analista ou coordenação. Os exercícios se ajustam ao seu momento.",
    ],
  },
  {
    slug: "analise-de-dados",
    name: "Análise de Dados",
    roman: "II",
    c: "#2F5F66",
    ct: "#2A555B",
    tint: "#DCE7E6",
    h1: "Do “puxa esse relatório pra mim” para a pessoa consultada antes da decisão.",
    sub: "Um guia em três partes para quem trabalha com dados e quer que as análises virem recomendação. Com prompts prontos para usar a IA na limpeza, na revisão de código e na explicação de resultados.",
    heroSub: {
      crescer:
        "Um guia em três partes para quem quer crescer na área de dados dentro da empresa onde já está, organizando como as suas análises chegam até quem decide, com prompts prontos para IA na limpeza, na revisão e na explicação de resultados.",
      mudar:
        "Um guia em três partes para quem quer se candidatar a novas vagas de dados, com etapas semanais e prompts prontos para organizar portfólio, currículo e entrevistas técnicas.",
    },
    bonus: "Modelo de one-page para apresentar uma análise",
    bonusD: "Uma página para resumir pergunta, achado e recomendação, pronta para levar a uma reunião.",
    honestT: "Este guia não vai te ensinar a programar.",
    honest: "Ele não é um curso de SQL, Python ou estatística. O que ele faz é mostrar como transformar o que você já sabe em influência, em etapas pequenas, e onde a IA tira peso da parte técnica repetitiva.",
    gives: [
      "Diagnóstico de onde você está hoje como analista",
      "Três partes com etapas semanais curtas",
      "Páginas de reflexão e exercícios práticos",
      "Prompts prontos para limpar dados, revisar código e explicar resultados",
      "Roteiro para a conversa de carreira com a sua liderança",
    ],
    parts: [
      "Separar o que é pedido operacional do que pode virar análise de impacto.",
      "Escolher uma pergunta de negócio e responder com a ajuda da IA, do dado à recomendação.",
      "Apresentar a recomendação, medir o que mudou e posicionar o seu próximo passo.",
    ],
    parteIII: {
      crescer: {
        titulo: "Ser consultado antes da decisão",
        desc: "Adotar uma área de negócio, levar recomendações mensais e alinhar com a liderança um escopo mais estratégico.",
      },
      mudar: {
        titulo: "Buscar um time que use dados para decidir",
        desc: "Montar um portfólio com duas análises, filtrar empresas pela maturidade de dados e treinar a explicação de resultados.",
      },
    },
    prompts: [
      [
        "Transformar análise em recomendação",
        "Vou colar o resultado de uma análise sobre [tema]. Resuma em 3 frases para uma pessoa da diretoria: o que encontrei, por que importa e o que eu recomendaria fazer. Aponte qualquer conclusão que os dados não sustentam.",
      ],
      [
        "Revisar uma consulta",
        "Revise a consulta SQL abaixo. Explique o que ela faz linha a linha, aponte riscos de duplicidade ou filtro errado e sugira uma versão mais legível, sem mudar o resultado.\n\n[colar consulta]",
      ],
      [
        "Explicar para quem não é da área",
        "Explique o conceito de [conceito, ex.: intervalo de confiança] para um gerente comercial, usando um exemplo do dia a dia dele, em no máximo 5 linhas.",
      ],
    ],
    faq1: [
      "Preciso saber programar para aproveitar?",
      "Não. O guia fala de carreira e comunicação. Os prompts de código são opcionais e explicados passo a passo.",
    ],
  },
  {
    slug: "comercial",
    name: "Comercial",
    roman: "III",
    c: "#A65638",
    ct: "#8E4A30",
    tint: "#F1E1D6",
    h1: "Uma rotina comercial que não depende de estar motivado no dia.",
    sub: "Um guia em três partes para quem trabalha com vendas e quer resultados menos instáveis e um caminho claro para contas maiores ou liderança. Com prompts prontos para preparar reuniões, propostas e follow-ups.",
    heroSub: {
      crescer:
        "Um guia em três partes para quem quer crescer na área comercial dentro da empresa onde já está, com uma rotina mais sustentável e prompts prontos para preparar reuniões, propostas e follow-ups.",
      mudar:
        "Um guia em três partes para quem quer se candidatar a novas vagas comerciais, com etapas semanais e prompts prontos para organizar currículo, networking e entrevistas.",
    },
    bonus: "Roteiro de preparação para reuniões",
    bonusD: "Uma folha para preencher em dez minutos antes de cada reunião: contexto, perguntas e próximo passo.",
    honestT: "Este guia não vai bater a sua meta por você.",
    honest: "Ele não traz técnicas milagrosas de fechamento nem scripts para pressionar cliente. O que ele faz é organizar uma rotina sustentável, em etapas pequenas, e mostrar onde a IA economiza tempo de preparação.",
    gives: [
      "Diagnóstico da sua rotina comercial atual",
      "Três partes com etapas semanais curtas",
      "Páginas de reflexão e exercícios práticos",
      "Prompts prontos para reuniões, propostas e follow-ups",
      "Roteiro para a conversa de carreira com a sua liderança",
    ],
    parts: [
      "Olhar para os últimos meses sem culpa e entender o que de fato moveu o seu resultado.",
      "Montar uma rotina semanal mínima e usar a IA para preparar cada reunião.",
      "Escolher entre contas maiores ou liderança e preparar a conversa com a sua gestão.",
    ],
    parteIII: {
      crescer: {
        titulo: "Crescer para contas maiores ou liderança",
        desc: "Usar a rotina das etapas anteriores como prova de consistência e abrir a conversa com a gestão.",
      },
      mudar: {
        titulo: "Mudar para um contexto comercial melhor",
        desc: "Organizar seus números reais em uma narrativa, avaliar empresas pelo modelo de comissão e preparar a entrevista.",
      },
    },
    prompts: [
      [
        "Preparar uma reunião de descoberta",
        "Vou me reunir com [cargo] da empresa [empresa], do setor [setor]. Liste 5 perguntas abertas para entender o problema dela antes de falar do produto e 2 sinais que indicam que não é o momento de avançar.",
      ],
      [
        "Escrever um follow-up que não insiste",
        "Escreva um e-mail curto de follow-up para [nome], que recebeu a proposta há [dias] dias e não respondeu. Tom cordial, sem pressão, oferecendo uma saída fácil caso não seja prioridade agora.",
      ],
      [
        "Revisar o pipeline da semana",
        "Abaixo está a lista das minhas oportunidades abertas com etapa e última interação. Aponte quais estão paradas há mais tempo, sugira uma ação para cada e me ajude a escolher as 3 prioridades da semana.\n\n[colar lista]",
      ],
    ],
    faq1: [
      "Serve para quem vende para empresas e para consumidor final?",
      "Sim. As etapas tratam de rotina e posicionamento, que valem para os dois. Os prompts trazem exemplos de ambos.",
    ],
  },
  {
    slug: "administrativo",
    name: "Administrativo",
    roman: "IV",
    c: "#7A5E8A",
    ct: "#6b4a79",
    tint: "#EAE3EE",
    h1: "Uma rotina administrativa que mostra o seu valor e abre o próximo cargo.",
    sub: "Um guia em três partes para quem trabalha no administrativo e quer que o seu trabalho seja visto como estratégico, não só como suporte. Com prompts prontos para usar a IA em e-mails, planilhas, atas e processos.",
    heroSub: {
      crescer:
        "Um guia em três partes para quem quer crescer no administrativo dentro da empresa onde já está, com etapas semanais e prompts prontos para usar a IA nas tarefas que mais tomam o seu tempo.",
      mudar:
        "Um guia em três partes para quem quer se candidatar a novas vagas administrativas, com etapas semanais e prompts prontos para organizar currículo, LinkedIn e entrevistas.",
    },
    bonus: "",
    bonusD: "",
    honestT: "Este guia vai te ajudar a mostrar o valor que você já entrega.",
    honest: "Ele não substitui experiência, nem muda sozinho a forma como a empresa enxerga o administrativo. O que ele faz é organizar a sua próxima fase em etapas pequenas e mostrar onde a IA tira peso das tarefas repetitivas para sobrar tempo para o que aparece.",
    gives: [
      "Diagnóstico de onde você está hoje no administrativo",
      "Três partes com etapas semanais curtas",
      "Páginas de reflexão e exercícios práticos",
      "Prompts prontos para e-mails, planilhas, atas e mapeamento de processos",
      "Roteiro para a conversa de carreira com a sua liderança",
    ],
    parts: [
      "Mapear tudo o que passa pela sua mesa e separar o que é urgente do que é invisível.",
      "Usar a IA para enxugar a rotina e escolher um processo para melhorar e documentar.",
      "Mostrar o resultado dessa melhoria, abrir a conversa de carreira e definir os próximos seis meses.",
    ],
    parteIII: {
      crescer: {
        titulo: "Virar a referência que organiza a área",
        desc: "Propor assumir um processo de ponta a ponta, mostrar a melhoria feita e negociar o próximo nível com a sua liderança.",
      },
      mudar: {
        titulo: "Levar a sua organização para outra empresa",
        desc: "Traduzir melhorias de processo em linhas de currículo com resultado, mirar vagas de analista ou coordenação e preparar a entrevista.",
      },
    },
    prompts: [
      [
        "Transformar anotações em ata",
        "Vou colar as anotações soltas de uma reunião sobre [tema]. Organize em uma ata com: decisões tomadas, responsáveis, prazos e pontos em aberto. Não invente nada que não esteja nas anotações.\n\n[colar anotações]",
      ],
      [
        "Mapear um processo para melhorar",
        "Descreva em etapas numeradas o processo de [processo, ex.: reembolso de despesas] a partir do que vou contar. Depois aponte 3 gargalos prováveis e uma melhoria simples para cada, sem exigir sistema novo.\n\n[descrever o processo]",
      ],
      [
        "Escrever um e-mail difícil com calma",
        "Escreva um e-mail curto para [pessoa/área] explicando que [situação, ex.: o prazo não será cumprido]. Tom cordial e direto, com o motivo em uma frase, a nova proposta e uma pergunta clara no final.",
      ],
    ],
    faq1: [
      "Serve para assistente, auxiliar e analista administrativo?",
      "Sim. As etapas partem de onde você está, seja em recepção, secretariado, compras, RH operacional ou backoffice. Os exercícios se ajustam ao seu momento.",
    ],
  },
];

export function getAreaBySlug(slug: string): Area | undefined {
  return AREAS.find((a) => a.slug === slug);
}

export function getAllSlugs(): string[] {
  return AREAS.map((a) => a.slug);
}

export const PART_NAMES = ["Parar de correr", "Escolher o que importa", "Dar o próximo passo"];
export const PART_WEEKS = ["semanas 1–2", "semanas 3–5", "semanas 6–8"];

/** Páginas reais do PDF mostradas na galeria. Arquivo: /previews/{pasta}-p{n}.jpg (ver PREVIEW_PASTA). */
export const PDF_PAGES = [
  { n: "01", title: "A capa" },
  { n: "07", title: "A abertura de cada etapa" },
  { n: "08", title: "O diagnóstico" },
  { n: "10", title: "Os cartões de ação" },
  { n: "18", title: "O banco de prompts" },
];

/** Slug da área -> prefixo dos arquivos em public/previews (a área de dados usa "dados"). */
export const PREVIEW_PASTA: Record<string, string> = {
  financeiro: "financeiro",
  "analise-de-dados": "dados",
  comercial: "comercial",
  administrativo: "administrativo",
};

export const GUARANTEES = ["Acesso imediato, por e-mail", "Acesso permanente ao PDF"];

export const COMMON_FAQ: [string, string][] = [
  [
    "Qual trilha eu devo escolher?",
    "A que fizer mais sentido hoje. As etapas I e II são iguais para todos; a escolha só muda a etapa III, e o guia traz as duas ramificações completas.",
  ],
  [
    "Como eu recebo o guia?",
    "Assim que o pagamento é confirmado, o PDF chega no e-mail informado em poucos minutos. Se não aparecer, confira o spam ou escreva para o suporte.",
  ],
  [
    "Dá para ler no celular?",
    "Sim. O guia foi diagramado para tela pequena, com sumário clicável e etapas que cabem num intervalo do dia.",
  ],
  [
    "Preciso pagar por alguma ferramenta de IA?",
    "Não. Os prompts funcionam nas versões gratuitas das ferramentas mais comuns.",
  ],
  [
    "Por quanto tempo tenho acesso?",
    "Para sempre. O PDF é seu, e atualizações do guia chegam no mesmo e-mail.",
  ],
];
