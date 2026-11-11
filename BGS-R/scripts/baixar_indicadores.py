import json, urllib.request

URL = "https://apisidra.ibge.gov.br/values/t/4714/n6/all/v/93,6318,614/p/2022"
CAMPO = {"93": "pop", "6318": "area_km2", "614": "dens"}

with urllib.request.urlopen(URL, timeout=120) as r:
    linhas = json.load(r)

dados = {}
for l in linhas:
    if l["V"] == "Valor":
        continue
    try:
        v = float(l["V"])
    except ValueError:
        v = None
    dados.setdefault(l["D1C"], {})[CAMPO[l["D2C"]]] = v

with open("public/data/geo/../indicadores.json", "w", encoding="utf-8") as f:
    json.dump(dados, f, separators=(",", ":"))

mapa = {ft["properties"]["cod"] for ft in json.load(open("data/work/municipios-10pct.geojson", encoding="utf-8"))["features"]}
print("Municípios no IBGE:", len(dados))
print("Municípios no mapa:", len(mapa))
print("No mapa e sem dado:", sorted(mapa - dados.keys()))
print("No dado e fora do mapa:", sorted(dados.keys() - mapa))
print("Exemplo Riachuelo:", dados.get("2410900"))