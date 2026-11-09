# Pendências do dono

Ciclo 5, 2026-11-09, commit 78e048c. Cada item tem arquivo, linha e a decisão necessária. Nada aqui foi publicado nem inventado: `/sobre`, `/privacidade` e `/termos` seguem com `publicada: false` (`lib/institucional.ts:15-17`) e respondem 404 em produção (medido em 2026-11-09 17:25Z).

## 1. Marcadores no código

| Arquivo:linha | Marcador | Decisão do dono |
|---|---|---|
| `app/sobre/page.tsx:28` | TODO_CONFIRMAR nome, cargo atual | Nome e cargo reais do autor |
| `app/sobre/page.tsx:28-29` | TODO_CONFIRMAR tempo de experiência, foto | Tempo de experiência verificável; foto (ou nenhuma) |
| `app/sobre/page.tsx:43` | TODO_CONFIRMAR fontes e pesquisa por área | Quais fontes sustentam cada um dos 6 guias |
| `app/sobre/page.tsx:44` | TODO_CONFIRMAR quem revisou cada área | Quem validou Comercial, Marketing, CS, Financeiro, Dados e Administrativo, e com qual experiência. Sem isso, a página não pode afirmar experiência de primeira mão nessas áreas |
| `app/sobre/page.tsx:51` | TODO_CONFIRMAR LinkedIn | URL do perfil, se for público |
| `app/privacidade/page.tsx:24` | TODO_REVISAO_JURIDICA controlador | Nome ou razão social e documento |
| `app/privacidade/page.tsx:46` | TODO_REVISAO_JURIDICA base legal | Base legal de cada finalidade |
| `app/privacidade/page.tsx:59` | TODO_REVISAO_JURIDICA transferência internacional | Países e mecanismo por fornecedor (ver `docs/PRIVACIDADE_FLUXO_DE_DADOS.md`) |
| `app/privacidade/page.tsx:64` | TODO_REVISAO_JURIDICA retenção | Prazo de guarda; o código não apaga pedidos |
| `app/privacidade/page.tsx:70` | TODO_REVISAO_JURIDICA prazo de resposta | Prazo para atender titulares |
| `app/privacidade/page.tsx:75` | TODO_REVISAO_JURIDICA cookies | Se o Vercel Web Analytics exige aviso |
| `app/privacidade/page.tsx:80` | TODO_REVISAO_JURIDICA DPO | Encarregado |
| `app/termos/page.tsx:34` | TODO_REVISAO_JURIDICA reembolso | Política de reembolso e arrependimento (não existe; nenhum texto foi criado) |
| `app/termos/page.tsx:50` | TODO_REVISAO_JURIDICA fornecedor | Nome ou razão social e documento |

Varredura em páginas públicas renderizadas (produção, 7 URLs, `grep -oE 'TODO|[Ll]orem|XXX|TBD|\[n\]'`, case-sensitive): 0 ocorrências. Atenção: com `-i`, o padrão `TODO` casa com a palavra "todos" e gera falso positivo.

## 2. Termos: o que o código e as páginas já mostram

| Tema | O que existe | Fonte |
|---|---|---|
| Entrega | PDF e modelo de currículo ATS por e-mail após a confirmação do pagamento | `lib/guias.ts:452-453` (FAQ "Como eu recebo o guia?") |
| Acesso | "Para sempre. O PDF e o modelo de currículo são seus" | `lib/guias.ts:464-465` |
| Atualizações | "atualizações do guia chegam no mesmo e-mail" | `lib/guias.ts:465` |
| Reenvio | botão "Reenviar e-mail" após o pagamento | `components/venda/PixCheckout.tsx:363` |
| Suporte | e-mail `fabio.kro@outlook.com`; link "Falar com o suporte" | `lib/guias.ts:34`; `app/obrigado/page.tsx:111` |
| Licença de uso | só no rascunho de `/termos` ("uso pessoal e intransferível", sem revenda); nenhuma página pública afirma isso | `app/termos/page.tsx` (seção "Licença de uso") |
| Reembolso, garantia, arrependimento | não existe | TODO |

Decisão: confirmar a cláusula de licença do rascunho (ela não tem outra fonte no site) e definir a política de reembolso com o advogado.

## 3. Número de prompts por guia (T5)

- Fonte de verdade buscada: o PDF vendido não está versionado no repositório (`git ls-files | grep -iE "\.pdf$"` vazio). Há só 5 páginas de prévia em JPG por guia (`public/previews/*-p01/p07/p08/p10/p18.jpg`).
- O código tem 3 prompts de amostra por guia (`lib/guias.ts`, campo `prompts`, contagem por área: 3 em cada uma das 6). Isso é a amostra exibida na página, não o total do guia.
- Proposta: nenhum número. O total não é determinável a partir do repositório. O texto atual ("O guia completo traz outros prompts", `components/venda/IaSection.tsx:21`) fica como está até o dono informar o número contado no PDF de cada guia.

Decisão: contar os prompts em cada PDF e informar os 6 números; só então trocar o texto.

## 4. Outras decisões

1. CON-04: publicar `/sobre`, `/privacidade` e `/termos` agora (após revisão jurídica e confirmação dos dados acima) ou registrar por escrito que o risco de E-E-A-T foi aceito.
2. Perfis oficiais para `sameAs` da Organization (`lib/seo.ts:181`, omitido de propósito até existirem perfis reais).
3. Previews: cadastrar no escopo Preview apenas credenciais de teste (`docs/VERCEL_PREVIEW.md`).
4. Alias `copilotodecarreira.vercel.app` responde `404 DEPLOYMENT_NOT_FOUND` (medido em 2026-11-09 17:25Z). Se ninguém usa esse endereço, nada a fazer; se algum link aponta para ele, corrigir.
5. Ações na Vercel e no Search Console: ver a seção "acoes_do_dono" do relatório do ciclo 5 e `docs/HANDOFF_REVALIDADOR.md`.
