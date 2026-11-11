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

  function filtroMun(uf: string | null) {
    const f: any = uf ? ['==', ['get', 'uf'], uf] : SEM_MUN;
    map.setFilter('mun-fill', f);
    map.setFilter('mun-line', f);
  }

  function limpar() {
    if (selMun) fs('mun', selMun, 'selecionado', false);
    if (selEstado) fs('estados', selEstado, 'selecionado', false);
    selMun = null; selEstado = null;
    filtroMun(null);
  }

  map.on('click', (e) => {
    const m = selEstado ? map.queryRenderedFeatures(e.point, { layers: ['mun-fill'] })[0] : undefined;
    if (m) {
      if (selMun) fs('mun', selMun, 'selecionado', false);
      selMun = String(m.id);
      fs('mun', selMun, 'selecionado', true);
      const p: any = m.properties;
      const est = dados.features.find((x: any) => x.properties.uf === p.uf)?.properties;
          const i = ind[p.cod] ?? {};
      panel.innerHTML = `<h2>${p.nome}</h2>
        <p><b>Estado:</b> ${est?.nome ?? p.uf} (${p.uf})</p>
        <p><b>População (2022):</b> ${fmt(i.pop)} hab.</p>
        <p><b>Área:</b> ${fmt(i.area_km2, 2)} km²</p>
        <p><b>Densidade:</b> ${fmt(i.dens, 2)} hab./km²</p>
        <p><b>Código IBGE:</b> ${p.cod}</p>`;
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