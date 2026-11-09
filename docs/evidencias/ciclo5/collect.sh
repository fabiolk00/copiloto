#!/usr/bin/env bash
# collect.sh <BASE_URL> <OUTDIR> <PREFIX> : coleta as 9 URLs em 3 variações (default, googlebot, cachebust)
set -u
BASE="$1"; OUT="$2"; PFX="$3"; mkdir -p "$OUT"
GB="Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
TOOLS="$(cd "$(dirname "$0")" && pwd)"
for P in / /financeiro /analise-de-dados /comercial /marketing /customer-success /administrativo /sitemap.xml /robots.txt; do
  SLUG=$(echo "$P" | sed 's#^/##; s#[/.]#_#g'); [ -z "$SLUG" ] && SLUG=home
  for V in default googlebot cachebust; do
    F="$OUT/${PFX}_${SLUG}_${V}"
    case $V in
      default)   curl -sS --max-time 40 -D "$F.h" -o "$F.html" "$BASE$P" ;;
      googlebot) curl -sS --max-time 40 -H "User-Agent: $GB" -D "$F.h" -o "$F.html" "$BASE$P" ;;
      cachebust) curl -sS --max-time 40 -D "$F.h" -o "$F.html" "$BASE$P?cb=$(date +%s)" ;;
    esac
    echo "{\"url\":\"$P\",\"variacao\":\"$V\",\"coletado_utc\":\"$(date -u +%FT%TZ)\",\"r\":$(python3 "$TOOLS/extract.py" "$F.h" "$F.html" "$P")}"
  done
done
