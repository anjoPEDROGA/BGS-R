import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './style.css';


const URL_ESTADOS = '/data/geo/estados.geojson';
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

map.on('load', async () => {
  const dados = await (await fetch(URL_ESTADOS)).json();
  map.addSource('estados', { type: 'geojson', data: dados, promoteId: 'cod' });

  map.addLayer({
    id: 'estados-fill', type: 'fill', source: 'estados',
    paint: {
      'fill-color': ['case',
        ['boolean', ['feature-state', 'selecionado'], false], '#f59e0b',
        ['boolean', ['feature-state', 'hover'], false], '#3b82f6',
        '#1f3a5f'],
      'fill-opacity': 0.75,
    },
  });
  map.addLayer({
    id: 'estados-line', type: 'line', source: 'estados',
    paint: { 'line-color': '#5b7fa6', 'line-width': 0.8 },
  });

  let sel: string | null = null;
  let hov: string | null = null;
  const set = (id: string, k: string, v: boolean) =>
    map.setFeatureState({ source: 'estados', id }, { [k]: v });

  map.on('mousemove', 'estados-fill', (e) => {
    map.getCanvas().style.cursor = 'pointer';
    const id = e.features?.[0]?.id as string | undefined;
    if (!id || id === hov) return;
    if (hov) set(hov, 'hover', false);
    hov = id; set(id, 'hover', true);
  });
  map.on('mouseleave', 'estados-fill', () => {
    map.getCanvas().style.cursor = '';
    if (hov) set(hov, 'hover', false);
    hov = null;
  });

  map.on('click', (e) => {
    const f = map.queryRenderedFeatures(e.point, { layers: ['estados-fill'] })[0];
    if (sel) set(sel, 'selecionado', false);
    if (!f) { sel = null; panel.innerHTML = PANEL_VAZIO; return; }

    sel = String(f.id);
    set(sel, 'selecionado', true);
    const feat = dados.features.find((x: any) => x.properties.cod === sel);
    const p = feat.properties;
    panel.innerHTML = `<h2>${p.nome} (${p.uf})</h2>
      <p><b>Região:</b> ${p.regiao}</p>
      <p><b>Área:</b> ${Number(p.area_km2).toLocaleString('pt-BR')} km²</p>`;
    map.fitBounds(limites(feat.geometry), { padding: 80, duration: 800 });
  });
});