#!/usr/bin/env python3
"""Auditoria on-page do HTML BRUTO (sem JS), somente stdlib.
Uso: python3 scripts/seo/seo_audit.py <URL> [--json]
Saida: 0 sem falhas P0/P1; 1 com falhas; 2 erro de rede.
"""
import json, re, sys
from html.parser import HTMLParser
from urllib.parse import urlparse
from urllib.request import Request, urlopen


class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.title = ""; self._t = False; self.meta = {}; self.links = []
        self.h = []; self._h = None; self.imgs = []; self.ld = []; self._ld = None
        self.lang = None; self.charset = False; self.anchors = []; self.main = False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "html": self.lang = a.get("lang")
        elif tag == "main": self.main = True
        elif tag == "title": self._t = True
        elif tag == "meta":
            if a.get("charset"): self.charset = True
            k = (a.get("name") or a.get("property") or "").lower()
            if k: self.meta[k] = a.get("content", "")
        elif tag == "link": self.links.append(a)
        elif tag in ("h1", "h2", "h3", "h4", "h5", "h6"): self._h = [int(tag[1]), ""]
        elif tag == "img": self.imgs.append(a)
        elif tag == "a" and a.get("href") is not None: self.anchors.append(a)
        elif tag == "script" and (a.get("type") or "").lower() == "application/ld+json": self._ld = []

    def handle_endtag(self, tag):
        if tag == "title": self._t = False
        elif self._h and tag == f"h{self._h[0]}": self.h.append((self._h[0], self._h[1].strip())); self._h = None
        elif tag == "script" and self._ld is not None: self.ld.append("".join(self._ld)); self._ld = None

    def handle_data(self, d):
        if self._t: self.title += d
        if self._h is not None: self._h[1] += d
        if self._ld is not None: self._ld.append(d)


def audit(url):
    req = Request(url, headers={"User-Agent": "SEOAuditBot/1.0"})
    with urlopen(req, timeout=20) as r:
        status, headers, html, final = r.status, dict(r.headers), r.read().decode("utf-8", "replace"), r.geturl()
    out = []
    def add(i, sev, ok, msg, ev=""): out.append({"id": i, "sev": sev, "ok": bool(ok), "msg": msg, "evidence": str(ev)})
    p = Page(); p.feed(html)
    add("IDX-01", "P0", status == 200, "HTTP 200", status)
    add("IDX-01", "P0", "noindex" not in headers.get("X-Robots-Tag", "").lower(), "sem noindex em X-Robots-Tag")
    robots = p.meta.get("robots", "").lower()
    add("IDX-01", "P0", "noindex" not in robots, "sem noindex em meta robots", robots)
    canon = [l for l in p.links if (l.get("rel") or "").lower() == "canonical"]
    add("IDX-03", "P0", len(canon) == 1, "exatamente 1 canonical", len(canon))
    if len(canon) == 1:
        href = canon[0].get("href", ""); u = urlparse(href)
        add("IDX-03", "P0", u.scheme == "https" and u.netloc, "canonical absoluto HTTPS", href)
        add("IDX-03", "P1", u.path.rstrip("/") == urlparse(final).path.rstrip("/") and not u.query, "canonical autorreferente", href)
    t = p.title.strip()
    add("META-01", "P0", 0 < len(t) <= 70, "title presente (<=70)", f"{len(t)}: {t}")
    d = p.meta.get("description", "").strip()
    add("META-02", "P1", 50 <= len(d) <= 320, "description presente", len(d))
    add("META-03", "P1", p.lang and p.charset, "html lang + charset", p.lang)
    add("META-04", "P0", "width=device-width" in p.meta.get("viewport", ""), "viewport", p.meta.get("viewport", ""))
    miss = [k for k in ("og:title", "og:description", "og:url") if not p.meta.get(k)]
    add("META-05", "P2", not miss, "Open Graph basico", miss)
    add("META-05", "P2", bool(p.meta.get("og:image")), "og:image presente")
    h1 = [x for x in p.h if x[0] == 1]
    add("CON-01", "P1", len(h1) == 1, "exatamente 1 h1 no HTML bruto", len(h1))
    add("IDX-07", "P0", p.main, "<main> presente no HTML bruto (SSR)")
    body = re.sub(r"<(script|style)[\s\S]*?</\1>", " ", html, flags=re.I)
    words = len(re.sub(r"<[^>]+>", " ", body).split())
    add("IDX-07", "P0", words >= 150, "conteudo textual no HTML bruto (>=150 palavras)", words)
    add("A11Y-01", "P1", not [i for i in p.imgs if i.get("alt") is None], "imagens com alt")
    add("CWV-03", "P1", not [i for i in p.imgs if not (i.get("width") and i.get("height")) and "fill" not in i], "imagens com width/height")
    bad, types = [], []
    for raw in p.ld:
        try:
            data = json.loads(raw)
            for n in (data if isinstance(data, list) else data.get("@graph", [data])): types.append(n.get("@type"))
        except Exception as e: bad.append(str(e))
    add("SD-01", "P1", not bad, "JSON-LD valido", bad)
    add("SD-05", "P1", not {"FAQPage", "HowTo"} & set(types), "sem FAQPage/HowTo", types)
    add("IDX-08", "P0", not [a["href"] for a in p.anchors if a["href"].startswith("javascript:") or a["href"] in ("", "#")], "links rastreaveis")
    return out


if __name__ == "__main__":
    if len(sys.argv) < 2: print(__doc__); sys.exit(2)
    try: res = audit(sys.argv[1])
    except Exception as e: print(f"erro de rede: {e}", file=sys.stderr); sys.exit(2)
    fails = [r for r in res if not r["ok"]]
    if "--json" in sys.argv: print(json.dumps(res, ensure_ascii=False, indent=1))
    else:
        for r in res: print(f"[{'OK   ' if r['ok'] else 'FALHA'}] {r['id']} ({r['sev']}) {r['msg']}" + ("" if r["ok"] else f" -> {r['evidence']}"))
        print(f"\n{len(res)} verificacoes, {len(fails)} falhas")
    sys.exit(1 if any(r["sev"] in ("P0", "P1") for r in fails) else 0)
