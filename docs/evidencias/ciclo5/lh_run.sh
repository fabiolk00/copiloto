#!/usr/bin/env bash
# lh_run.sh <BASE> <OUTDIR> : Lighthouse mobile (preset padrão = mobile, throttling simulate), 3 execuções por página
S=/tmp/claude-0/-home-user-copiloto/8615085d-d3a5-50ae-9433-8a6bd05fbc81/scratchpad
BASE="$1"; OUT="$2"; mkdir -p "$OUT"
export CHROME_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome
for P in / /financeiro /analise-de-dados /comercial /marketing /customer-success /administrativo; do
  SLUG=$(echo "$P" | sed 's#^/##'); [ -z "$SLUG" ] && SLUG=home
  for i in 1 2 3; do
    "$S/lh/node_modules/.bin/lighthouse" "$BASE$P" --quiet --only-categories=performance \
      --chrome-flags="--headless=new --no-sandbox" --output=json --output-path="$OUT/${SLUG}_$i.json" >/dev/null 2>&1
    echo "$SLUG run$i exit=$? $(date -u +%FT%TZ)"
  done
done
