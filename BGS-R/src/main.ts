import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Protocol } from 'pmtiles';
import './style.css';

maplibregl.addProtocol('pmtiles', new Protocol().tile);

const URL_ESTADOS = '/data/geo/estados.geojson';
const URL_MUN = `pmtiles://${location.origin}/data/geo/municipios.pmtiles`;
const panel = document.getElementById('panel')!;
const PANEL_VAZIO = '<p>Clique em um estado.</p>';
panel.innerHTML = PANEL_VAZIO;

function limites(geom: any): maplibregl.LngLatBounds {
  const b = new maplibregl.LngLatBounds();
  const percorrer = (c: any) => (typeof c[0] === 'number' ? b.extend(c) : c.forEach(percorrer));
  percorrer(geom.coordinates);
  return b;
}

const map = new maplibregl.Map({
  container: 'map',
  style: { version: 8, sources: {}, layers: [{ id: 'fundo', type: 'background', paint: { 'background-color': '#0b0f14' } }] },
  center: [-52, -14],
  zoom: 3.6,
  attributionControl: false,
});

const corEstado: any = ['case',
  ['boolean', ['feature-state', 'selecionado'], false], '#f59e0b',
  ['boolean', ['feature-state', 'hover'], false], '#3b82f6',
  '#1f3a5f'];
const corMun: any = ['case',
  ['boolean', ['feature-state', 'selecionado'], false], '#f59e0b',
  ['boolean', ['feature-state', 'hover'], false], '#3b82f6',
  '#2a4a73'];
const SEM_MUN: any = ['==', ['get', 'uf'], ''];

map.on('load', async () => {
  const dados = await (await fetch(URL_ESTADOS)).json();
  const ind: Record<string, any> = await (await fetch('/data/indicadores.json')).json();
  const fmt = (v: any, casas = 0) =>
    v == null ? 'sem dados' : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
  
  map.addSource('estados', { type: 'geojson', data: dados, promoteId: 'cod' });
  map.addSource('mun', { type: 'vector', url: URL_MUN, promoteId: { municipios: 'cod' } });

  map.addLayer({ id: 'estados-fill', type: 'fill', source: 'estados', paint: { 'fill-color': corEstado, 'fill-opacity': 0.75 } });
  map.addLayer({ id: 'mun-fill', type: 'fill', source: 'mun', 'source-layer': 'municipios', filter: SEM_MUN,
    paint: { 'fill-color': corMun, 'fill-opacity': 0.9 } });
  map.addLayer({ id: 'mun-line', type: 'line', source: 'mun', 'source-layer': 'municipios', filter: SEM_MUN,
    paint: { 'line-color': '#7aa2d1', 'line-width': 0.6 } });
  map.addLayer({ id: 'estados-line', type: 'line', source: 'estados', paint: { 'line-color': '#5b7fa6', 'line-width': 0.8 } });

  let selEstado: string | null = null;
  let selMun: string | null = null;
  const hover: Record<string, string | null> = { estados: null, mun: null };

  const fs = (src: string, id: string, k: string, v: boolean) =>
    map.setFeatureState(src === 'mun' ? { source: 'mun', sourceLayer: 'municipios', id } : { source: 'estados', id }, { [k]: v });

  function ligarHover(src: 'estados' | 'mun', camada: string) {
    map.on('mousemove', camada, (e) => {
      map.getCanvas().style.cursor = 'pointer';
      const id = e.features?.[0]?.id as string | undefined;
      if (!id || id === hover[src]) return;
      if (hover[src]) fs(src, hover[src]!, 'hover', false);
      hover[src] = id; fs(src, id, 'hover', true);
    });
    map.on('mouseleave', camada, () => {
      map.getCanvas().style.cursor = '';
      if (hover[src]) fs(src, hover[src]!, 'hover', false);
      hover[src] = null;
    });
  }
  ligarHover('estados', 'estados-fill');
  ligarHover('mun', 'mun-fill');

  let indicadorAtivo = '';
  let ufAtual: string | null = null;

  function filtroMun(uf: string | null) {
    ufAtual = uf;
    const f: any = indicadorAtivo ? null : (ufAtual ? ['==', ['get', 'uf'], ufAtual] : SEM_MUN);
    map.setFilter('mun-fill', f);
    map.setFilter('mun-line', f);
  }

  function limpar() {
    if (selMun) fs('mun', selMun, 'selecionado', false);
    if (selEstado) fs('estados', selEstado, 'selecionado', false);
    selMun = null; selEstado = null;
    filtroMun(null);
  }

  const CORES = ['#2b3a67', '#3f6aa3', '#4f9cc0', '#7fd0c0', '#d9e98b', '#f5c542'];
  const SEM_DADO = '#3a3f47';
  const legenda = document.getElementById('legenda')!;
  const seletor = document.getElementById('ind') as HTMLSelectElement;

  function aplicarIndicador(chave: string) {
    indicadorAtivo = chave;
    limpar();
    panel.innerHTML = PANEL_VAZIO;

    if (!chave) {
      map.setPaintProperty('mun-fill', 'fill-color', corMun);
      map.setPaintProperty('mun-line', 'line-opacity', 1);
      legenda.innerHTML = '';
      return;
    }

    const vals = Object.values(ind).map((x: any) => x[chave])
      .filter((v: any) => v != null && v > 0).sort((a: number, b: number) => a - b);
    const quebras: number[] = [];
    CORES.forEach((_, k) => {
      const q = vals[Math.floor((k * vals.length) / CORES.length)];
      if (!quebras.length || q > quebras[quebras.length - 1]) quebras.push(q);
    });

    for (const [cod, x] of Object.entries(ind)) {
      map.setFeatureState({ source: 'mun', sourceLayer: 'municipios', id: cod }, { valor: (x as any)[chave] ?? -1 });
    }

    const passos: any[] = [];
    quebras.forEach((q, k) => passos.push(q, CORES[k]));
    const cor: any = ['step', ['coalesce', ['feature-state', 'valor'], -1], SEM_DADO, ...passos];
    map.setPaintProperty('mun-fill', 'fill-color', ['case',
      ['boolean', ['feature-state', 'selecionado'], false], '#ffff80',
      ['boolean', ['feature-state', 'hover'], false], '#ffffff',
      cor]);
    map.setPaintProperty('mun-line', 'line-opacity', 0.25);

    const casas = chave === 'dens' ? 1 : 0;
    legenda.innerHTML = quebras.map((q, k) =>
      `<div><span class="cor" style="background:${CORES[k]}"></span>${fmt(q, casas)}${k < quebras.length - 1 ? ' a ' + fmt(quebras[k + 1], casas) : '+'}</div>`
    ).join('') + `<div><span class="cor" style="background:${SEM_DADO}"></span>sem dados</div>`;
  }

  seletor.addEventListener('change', () => aplicarIndicador(seletor.value));

  function mostrarMunicipio(cod: string, nome: string, uf: string) {
    const est = dados.features.find((x: any) => x.properties.uf === uf)?.properties;
    const i = ind[cod] ?? {};
    panel.innerHTML = `<h2>${nome}</h2>
      <p><b>Estado:</b> ${est?.nome ?? uf} (${uf})</p>
      <p><b>População (2022):</b> ${fmt(i.pop)} hab.</p>
      <p><b>Área:</b> ${fmt(i.area_km2, 2)} km²</p>
      <p><b>Densidade:</b> ${fmt(i.dens, 2)} hab./km²</p>
      <p><b>Código IBGE:</b> ${cod}</p>`;
  }

  const busca: any[] = await (await fetch('/data/busca.json')).json();
  const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const indice = busca.map((c) => ({ c, n: norm(c[1]) }));
  const entrada = document.getElementById('busca') as HTMLInputElement;
  const caixaRes = document.getElementById('resultados')!;
  let achados: any[] = [];

  function irParaMunicipio(c: any[]) {
    const [cod, nome, uf, x0, y0, x1, y1] = c;
    const est = dados.features.find((x: any) => x.properties.uf === uf);
    if (selMun) fs('mun', selMun, 'selecionado', false);
    if (selEstado) fs('estados', selEstado, 'selecionado', false);
    selEstado = String(est.properties.cod);
    fs('estados', selEstado, 'selecionado', true);
    filtroMun(uf);
    selMun = cod;
    fs('mun', cod, 'selecionado', true);
    mostrarMunicipio(cod, nome, uf);
    map.fitBounds([[x0, y0], [x1, y1]], { padding: 120, duration: 800, maxZoom: 10 });
    entrada.value = ''; caixaRes.innerHTML = ''; achados = [];
  }

  entrada.addEventListener('input', () => {
    const q = norm(entrada.value.trim());
    if (q.length < 2) { caixaRes.innerHTML = ''; achados = []; return; }
    const ini = indice.filter((x) => x.n.startsWith(q));
    const meio = indice.filter((x) => !x.n.startsWith(q) && x.n.includes(q));
    achados = [...ini, ...meio].slice(0, 8).map((x) => x.c);
    caixaRes.innerHTML = achados.map((c, k) => `<div data-k="${k}">${c[1]}<small>${c[2]}</small></div>`).join('');
  });

  entrada.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && achados[0]) irParaMunicipio(achados[0]);
    if (e.key === 'Escape') { entrada.value = ''; caixaRes.innerHTML = ''; achados = []; }
  });

  caixaRes.addEventListener('click', (e) => {
    const k = (e.target as HTMLElement).closest('div')?.getAttribute('data-k');
    if (k != null) irParaMunicipio(achados[Number(k)]);
  });

  map.on('click', (e) => {
    const m = map.queryRenderedFeatures(e.point, { layers: ['mun-fill'] })[0];
    if (m) {
      if (selMun) fs('mun', selMun, 'selecionado', false);
      selMun = String(m.id);
      fs('mun', selMun, 'selecionado', true);
      const p: any = m.properties;
      mostrarMunicipio(p.cod, p.nome, p.uf);
      return;
    }

    const f = map.queryRenderedFeatures(e.point, { layers: ['estados-fill'] })[0];
    limpar();
    if (!f) { panel.innerHTML = PANEL_VAZIO; return; }

    selEstado = String(f.id);
    fs('estados', selEstado, 'selecionado', true);
    const feat = dados.features.find((x: any) => x.properties.cod === selEstado);
    const p = feat.properties;
    filtroMun(p.uf);
    panel.innerHTML = `<h2>${p.nome} (${p.uf})</h2>
      <p><b>Região:</b> ${p.regiao}</p>
      <p><b>Área:</b> ${Number(p.area_km2).toLocaleString('pt-BR')} km²</p>
      <p>Clique em um município.</p>`;
    map.fitBounds(limites(feat.geometry), { padding: 80, duration: 800 });
  });
});