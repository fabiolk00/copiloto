# Evidências do ciclo 5 (2026-11-09, UTC)

Saídas brutas resumidas das medições do ciclo 5. Os scripts aqui (`collect.sh`, `extract.py`, `lh_run.sh`, `lh_medianas.py`) são ferramentas de medição, não fazem parte do site e não são importados pelo build.

| Arquivo | Conteúdo | Comando |
|---|---|---|
| `t1_producao_rodada1.jsonl` | 9 URLs x 3 variações (default, Googlebot, cache-bust), 17:24:57Z a 17:25:05Z: status, date, age, x-vercel-cache, x-vercel-id, etag, sha256 e campos do HTML | `bash collect.sh https://www.copilotocarreira.com.br <dir> prod1` |
| `t1_producao_rodada2.jsonl` | mesma coleta, 17:42:59Z a 17:43:04Z | `bash collect.sh … prod2` |
| `t1_local_78e048c.jsonl` | mesma coleta contra `next start` do commit 78e048c (checkout limpo, `npm ci`, `next build` com variáveis fictícias, `VERCEL_ENV=production`) | `bash collect.sh http://127.0.0.1:3078 <dir> local` |
| `t1_comparacao_campos.txt` | produção (cada variação) x local, campo a campo | script de comparação do ciclo 5 |
| `t3_build_sem_variavel.txt` | `next build` sem cada variável obrigatória e com valores inválidos | `unset <VAR>; npx next build` |
| `t4_lighthouse_local.txt`, `t4_lighthouse_producao.txt` | Lighthouse 13.6.0 mobile, 3 execuções, medianas de LCP, TBT, CLS, FCP | `bash lh_run.sh <base> <dir>`; `python3 lh_medianas.py <dir>` |
| `t4_lcp_elemento_*.txt` | elemento LCP e subpartes (TTFB, atraso de renderização) | idem |
| `t4_devtools_marketing_local.txt` | `/marketing` local com `--throttling-method=devtools` | `lighthouse … --throttling-method=devtools` |
| `seo_audit_producao.txt` | falhas do `seo_audit.py` (harness 6.6) nas 7 URLs de produção, 17:42Z | `python3 seo_audit.py <URL> --json` |
| `check_http_marketing.txt` | passos de `check_http.sh` (harness 6.7), exceto o passo `http://` | ver arquivo |

Variáveis fictícias usadas no build local: `MP_ACCESS_TOKEN=APP_USR-ficticio`, `MP_WEBHOOK_SECRET=ficticio`, `MP_PIX_EXPIRATION=PT30M`, `DATABASE_URL=postgresql://postgres:ficticio@127.0.0.1:6543/postgres`, `SUPABASE_URL=https://ficticio.supabase.co`, `SUPABASE_SERVICE_ROLE_KEY=ficticio`, `APP_URL=https://www.copilotocarreira.com.br`, `VERCEL_ENV=production`.

Limite da coleta: todas as respostas de produção vieram do nó `iad1` da Vercel (uma única saída de rede). Outras regiões não foram medidas.
