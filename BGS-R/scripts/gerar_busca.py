import json

fc = json.load(open("data/work/municipios-10pct.geojson", encoding="utf-8"))

def caixa(coords, b):
    if isinstance(coords[0], (int, float)):
        b[0] = min(b[0], coords[0]); b[1] = min(b[1], coords[1])
        b[2] = max(b[2], coords[0]); b[3] = max(b[3], coords[1])
    else:
        for c in coords:
            caixa(c, b)

saida = []
for ft in fc["features"]:
    b = [999, 999, -999, -999]
    caixa(ft["geometry"]["coordinates"], b)
    p = ft["properties"]
    saida.append([p["cod"], p["nome"], p["uf"]] + [round(v, 4) for v in b])

json.dump(saida, open("public/data/busca.json", "w", encoding="utf-8"),
          ensure_ascii=False, separators=(",", ":"))
print("Municípios:", len(saida))