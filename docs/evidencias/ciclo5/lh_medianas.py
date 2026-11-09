import json,sys,statistics
d=sys.argv[1]
for slug in ["home","financeiro","analise-de-dados","comercial","marketing","customer-success","administrativo"]:
    L=[];T=[];C=[];F=[]
    for i in (1,2,3):
        a=json.load(open(f"{d}/{slug}_{i}.json"))["audits"]
        L.append(round(a["largest-contentful-paint"]["numericValue"]));T.append(round(a["total-blocking-time"]["numericValue"]));C.append(round(a["cumulative-layout-shift"]["numericValue"],4));F.append(round(a["first-contentful-paint"]["numericValue"]))
    print(f"{slug:<17} LCP_med={statistics.median(L)} {L}  TBT_med={statistics.median(T)} {T}  CLS_med={statistics.median(C)}  FCP_med={statistics.median(F)}")
