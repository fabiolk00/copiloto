#!/usr/bin/env python3
"""extract.py <headers_file> <body_file> <path>
Extrai, de uma resposta salva por curl -D, os campos da T1 (1.1 e 1.2) e imprime JSON.
"""
import hashlib, json, re, sys
from html.parser import HTMLParser

# Frases-âncora reais do FAQ (lib/guias.ts): resposta de faq1 de cada guia + 2 respostas de COMMON_FAQ.
FAQ_FAQ1 = {
    "/financeiro": "seja assistente, analista ou coordenação",
    "/analise-de-dados": "Os prompts de código são opcionais e explicados passo a passo",
    "/comercial": "As etapas tratam de rotina e posicionamento, que valem para os dois",
    "/administrativo": "seja em recepção, secretariado, compras, RH operacional ou backoffice",
    "/marketing": "seja conteúdo, mídia paga, CRM ou marca",
    "/customer-success": "seja atendimento, onboarding ou gestão de carteira",
}
FAQ_COMUM = [
    "As etapas I e II são iguais para todos",
    "Os prompts funcionam nas versões gratuitas das ferramentas mais comuns",
]
# Home: respostas do FAQ da home (app/page.tsx)
FAQ_HOME = [
    "Guias digitais em PDF por profissão, com etapas semanais",
    "Os prompts são prontos: você copia, cola e ajusta ao seu caso",
    "comece pela que ocupa a maior parte da sua semana",
]


class P(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.title = ""; self._t = False; self.meta = {}; self.canon = []; self.h = []; self._h = None
        self.ld = []; self._ld = None
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "title": self._t = True
        elif tag == "meta":
            k = (a.get("name") or a.get("property") or "").lower()
            if k: self.meta[k] = a.get("content", "")
        elif tag == "link" and (a.get("rel") or "").lower() == "canonical": self.canon.append(a.get("href"))
        elif tag in ("h1", "h2", "h3"): self._h = [tag, ""]
        elif tag == "script" and (a.get("type") or "") == "application/ld+json": self._ld = []
    def handle_endtag(self, tag):
        if tag == "title": self._t = False
        elif self._h and tag == self._h[0]: self.h.append((self._h[0], " ".join(self._h[1].split()))); self._h = None
        elif tag == "script" and self._ld is not None: self.ld.append("".join(self._ld)); self._ld = None
    def handle_data(self, d):
        if self._t: self.title += d
        if self._h is not None: self._h[1] += d
        if self._ld is not None: self._ld.append(d)


def headers(path):
    raw = open(path, encoding="latin-1").read().replace("\r", "")
    blocks = [b for b in raw.split("\n\n") if b.strip()]
    last = blocks[-1].split("\n")
    st = last[0]
    h = {}
    for line in last[1:]:
        if ":" in line:
            k, v = line.split(":", 1); h[k.strip().lower()] = v.strip()
    return st, h


def main():
    hf, bf, path = sys.argv[1:4]
    st, h = headers(hf)
    body = open(bf, "rb").read()
    out = {
        "status_line": st,
        "date": h.get("date"), "age": h.get("age"), "x_vercel_cache": h.get("x-vercel-cache"),
        "x_vercel_id": h.get("x-vercel-id"), "cache_control": h.get("cache-control"), "etag": h.get("etag"),
        "content_length": h.get("content-length"), "bytes": len(body), "sha256": hashlib.sha256(body).hexdigest(),
    }
    text = body.decode("utf-8", "replace")
    if path.endswith(".xml"):
        locs = re.findall(r"<loc>(.*?)</loc>", text)
        out["campos"] = {"loc_count": len(locs), "locs": locs, "lastmod": re.findall(r"<lastmod>(.*?)</lastmod>", text)}
    elif path.endswith(".txt"):
        out["campos"] = {"robots": text.strip()}
    else:
        p = P(); p.feed(text)
        types = []
        for raw in p.ld:
            try:
                d = json.loads(raw)
                for n in (d if isinstance(d, list) else d.get("@graph", [d])):
                    types.append(n.get("@type"))
            except Exception as e:
                types.append(f"INVALIDO:{e}")
        anchors = [FAQ_FAQ1[path]] + FAQ_COMUM if path in FAQ_FAQ1 else FAQ_HOME
        visible = re.sub(r"<(script|style)[\s\S]*?</\1>", " ", text, flags=re.I)
        out["campos"] = {
            "title": p.title.strip(), "description": p.meta.get("description"), "canonical": p.canon,
            "robots": p.meta.get("robots"), "h1": [t for tg, t in p.h if tg == "h1"],
            "h2_count": sum(1 for tg, _ in p.h if tg == "h2"),
            "tem_n": "[n]" in text,
            "faq_ancoras": {a: (a in text) for a in anchors},
            "faq_respostas": bool(anchors) and all(a in text for a in anchors),
            "json_ld": types, "og_image": p.meta.get("og:image"),
            "tem_footer": "<footer" in text,
            "palavras_visiveis": len(re.sub(r"<[^>]+>", " ", visible).split()),
        }
    print(json.dumps(out, ensure_ascii=False))


if __name__ == "__main__":
    main()
