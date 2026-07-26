'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet-draw';
import { supabase } from '@/lib/supabase';

const ALMATY_CENTER: [number, number] = [43.238949, 76.889709];
const DEFAULT_ZOOM = 11;

// Половина стороны области авторазметки в градусах (примерно 20 км на 21 км вокруг центра)
const GRID_HALF_LAT = 0.09;
const GRID_HALF_LNG = 0.13;
const JITTER_FACTOR = 0.35;

const PALETTE = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
];

interface ZoneRow {
  id: string;
  name: string;
  color: string;
  coordinates: GeoJSON.Polygon;
}

interface ZoneMeta {
  id: string;
  name: string;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildPopupHtml(zoneId: string, name: string) {
  return `
    <div style="min-width:160px">
      <b>${escapeHtml(name)}</b><br/>
      <button data-delete-zone="${zoneId}"
        style="margin-top:6px;background:#dc2626;color:#fff;border:none;
        padding:5px 12px;border-radius:6px;font-weight:600;cursor:pointer">
        🗑 Удалить зону</button>
    </div>`;
}

/** Сетка N×N с "расшатанными" внутренними узлами — соседние ячейки делят общие узлы,
 *  поэтому между зонами нет ни щелей, ни наложений. */
function buildGridCells(n: number): [number, number][][] {
  const latMin = ALMATY_CENTER[0] - GRID_HALF_LAT;
  const latMax = ALMATY_CENTER[0] + GRID_HALF_LAT;
  const lngMin = ALMATY_CENTER[1] - GRID_HALF_LNG;
  const lngMax = ALMATY_CENTER[1] + GRID_HALF_LNG;
  const latStep = (latMax - latMin) / n;
  const lngStep = (lngMax - lngMin) / n;

  const nodes: [number, number][][] = [];
  for (let i = 0; i <= n; i++) {
    const row: [number, number][] = [];
    for (let j = 0; j <= n; j++) {
      let lat = latMin + i * latStep;
      let lng = lngMin + j * lngStep;
      const isBoundary = i === 0 || i === n || j === 0 || j === n;
      if (!isBoundary) {
        lat += (Math.random() * 2 - 1) * JITTER_FACTOR * latStep;
        lng += (Math.random() * 2 - 1) * JITTER_FACTOR * lngStep;
      }
      row.push([lat, lng]);
    }
    nodes.push(row);
  }

  const cells: [number, number][][] = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      cells.push([nodes[i][j], nodes[i + 1][j], nodes[i + 1][j + 1], nodes[i][j + 1]]);
    }
  }
  return cells;
}

function cellToGeoJSON(cell: [number, number][]): GeoJSON.Polygon {
  const ring = cell.map(([lat, lng]) => [lng, lat]);
  ring.push(ring[0]);
  return { type: 'Polygon', coordinates: [ring] };
}

export default function ZoneMapEditor() {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const drawnItemsRef = useRef<L.FeatureGroup | null>(null);
  const drawControlRef = useRef<any>(null);
  const polygonHandlerRef = useRef<any>(null);
  const sellerIdRef = useRef<string | null>(null);

  const zoneLayersRef = useRef<Map<string, L.Polygon>>(new Map());
  const layerMetaRef = useRef<Map<number, ZoneMeta>>(new Map());
  const zonesCountRef = useRef(0);

  const [zonesCount, setZonesCountState] = useState(0);
  const [showFinishBtn, setShowFinishBtn] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  function setZonesCount(updater: (c: number) => number) {
    zonesCountRef.current = updater(zonesCountRef.current);
    setZonesCountState(zonesCountRef.current);
  }

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let map: L.Map;
    let drawnItems: L.FeatureGroup;
    let drawControl: any;

    try {
      if (!(L.Control as any).Draw) {
        throw new Error(
          "L.Control.Draw не определён — плагин leaflet-draw не подключился к используемому " +
            "экземпляру L (возможно, дублирующийся пакет leaflet в node_modules)."
        );
      }

      map = L.map(containerRef.current).setView(ALMATY_CENTER, DEFAULT_ZOOM);
      mapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      drawnItems = new L.FeatureGroup();
      drawnItemsRef.current = drawnItems;
      map.addLayer(drawnItems);

      drawControl = new (L.Control as any).Draw({
        position: 'topleft',
        draw: {
          polygon: {
            allowIntersection: false,
            showArea: false,
            shapeOptions: { color: '#3b82f6', weight: 2, fillOpacity: 0.35 },
          },
          polyline: false,
          rectangle: false,
          circle: false,
          circlemarker: false,
          marker: false,
        },
        edit: {
          featureGroup: drawnItems,
          remove: true,
        },
      });
      map.addControl(drawControl);
      drawControlRef.current = drawControl;
    } catch (err) {
      console.error('Ошибка инициализации карты/тулбара рисования зон:', err);
      setInitError(err instanceof Error ? err.message : String(err));
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      return;
    }

    (async () => {
      await getSellerId();
      await loadExistingZones();
    })();

    map.on((L as any).Draw.Event.DRAWSTART, (e: any) => {
      if (e.layerType !== 'polygon') return;
      const handler = drawControl._toolbars?.draw?._modes?.polygon?.handler;
      polygonHandlerRef.current = handler || null;
      setShowFinishBtn(true);
    });

    map.on((L as any).Draw.Event.DRAWSTOP, () => {
      setShowFinishBtn(false);
      polygonHandlerRef.current = null;
    });

    map.on((L as any).Draw.Event.CREATED, async (e: any) => {
      const layer = e.layer as L.Polygon;

      const name = window.prompt('Название зоны:');
      if (!name || !name.trim()) return;
      const trimmed = name.trim();

      const sellerId = await getSellerId();
      if (!sellerId) {
        alert('Не удалось определить продавца, обновите страницу и попробуйте снова');
        return;
      }

      const geojson = (layer.toGeoJSON() as any).geometry;
      const color = PALETTE[zonesCountRef.current % PALETTE.length];

      const { data, error } = await supabase
        .from('zones')
        .insert({
          seller_id: sellerId,
          name: trimmed,
          coordinates: geojson,
          color,
        })
        .select('id')
        .single();

      if (error || !data) {
        console.error('Ошибка сохранения зоны:', error);
        alert('Ошибка сохранения зоны: ' + (error?.message || 'unknown'));
        return;
      }

      layer.setStyle({ color, weight: 2, fillOpacity: 0.35 });
      drawnItems.addLayer(layer);
      zoneLayersRef.current.set(data.id, layer);
      attachZoneInteractions(layer, data.id, trimmed);
      setZonesCount((c) => c + 1);
    });

    map.on((L as any).Draw.Event.EDITED, (e: any) => {
      const layers = e.layers as L.LayerGroup;
      layers.eachLayer(async (layer: any) => {
        const meta = layerMetaRef.current.get(L.Util.stamp(layer));
        if (!meta) return;
        const geojson = layer.toGeoJSON().geometry;
        const { error } = await supabase
          .from('zones')
          .update({ coordinates: geojson })
          .eq('id', meta.id);
        if (error) alert('Ошибка сохранения изменений: ' + error.message);
      });
    });

    map.on((L as any).Draw.Event.DELETED, (e: any) => {
      const layers = e.layers as L.LayerGroup;
      layers.eachLayer(async (layer: any) => {
        const stamp = L.Util.stamp(layer);
        const meta = layerMetaRef.current.get(stamp);
        if (!meta) return;
        const { error } = await supabase.from('zones').delete().eq('id', meta.id);
        if (error) {
          alert('Ошибка удаления: ' + error.message);
          return;
        }
        layerMetaRef.current.delete(stamp);
        zoneLayersRef.current.delete(meta.id);
        setZonesCount((c) => Math.max(0, c - 1));
      });
    });

    map.on('popupopen', (e: any) => {
      const el = e.popup.getElement();
      const btn = el?.querySelector('[data-delete-zone]') as HTMLElement | null;
      if (btn) {
        btn.onclick = () => {
          const zoneId = btn.getAttribute('data-delete-zone')!;
          deleteZone(zoneId);
        };
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function attachZoneInteractions(layer: L.Polygon, zoneId: string, name: string) {
    layerMetaRef.current.set(L.Util.stamp(layer), { id: zoneId, name });
    layer.bindTooltip(name, { direction: 'center', className: 'zone-tooltip' });
    layer.bindPopup(buildPopupHtml(zoneId, name));

    layer.on('dblclick', (e: any) => {
      L.DomEvent.stop(e);
      const meta = layerMetaRef.current.get(L.Util.stamp(layer));
      if (!meta) return;
      const newName = window.prompt('Новое название зоны:', meta.name);
      if (newName === null) return;
      const trimmed = newName.trim();
      if (!trimmed || trimmed === meta.name) return;
      renameZone(layer, meta.id, trimmed);
    });
  }

  async function getSellerId(): Promise<string | null> {
    if (sellerIdRef.current) return sellerIdRef.current;
    const { data } = await supabase.auth.getUser();
    sellerIdRef.current = data?.user?.id ?? null;
    return sellerIdRef.current;
  }

  async function renameZone(layer: L.Polygon, zoneId: string, newName: string) {
    const { error } = await supabase.from('zones').update({ name: newName }).eq('id', zoneId);
    if (error) {
      alert('Ошибка переименования: ' + error.message);
      return;
    }
    layerMetaRef.current.set(L.Util.stamp(layer), { id: zoneId, name: newName });
    layer.setTooltipContent(newName);
    layer.setPopupContent(buildPopupHtml(zoneId, newName));
  }

  async function deleteZone(zoneId: string) {
    if (!window.confirm('Удалить эту зону?')) return;

    const { error } = await supabase.from('zones').delete().eq('id', zoneId);
    if (error) {
      alert('Ошибка удаления: ' + error.message);
      return;
    }

    const layer = zoneLayersRef.current.get(zoneId);
    if (layer) {
      drawnItemsRef.current?.removeLayer(layer);
      layerMetaRef.current.delete(L.Util.stamp(layer));
      zoneLayersRef.current.delete(zoneId);
    }
    setZonesCount((c) => Math.max(0, c - 1));
  }

  async function loadExistingZones() {
    const drawnItems = drawnItemsRef.current;
    if (!drawnItems) return;

    const { data, error } = await supabase
      .from('zones')
      .select('id, name, color, coordinates')
      .eq('seller_id', sellerIdRef.current)
      .order('created_at');

    if (error) {
      console.error('Ошибка загрузки зон:', error);
      return;
    }

    const zones = (data || []) as ZoneRow[];

    zones.forEach((zone, i) => {
      const color = zone.color || PALETTE[i % PALETTE.length];
      try {
        const latlngs = zone.coordinates.coordinates[0].map(
          ([lng, lat]) => [lat, lng] as [number, number]
        );
        const layer = L.polygon(latlngs, { color, weight: 2, fillOpacity: 0.35 });
        drawnItems.addLayer(layer);
        zoneLayersRef.current.set(zone.id, layer);
        attachZoneInteractions(layer, zone.id, zone.name);
      } catch (e) {
        console.error('Не удалось отрисовать зону', zone.name, e);
      }
    });

    setZonesCount(() => zones.length);
  }

  function finishPolygon() {
    const handler =
      polygonHandlerRef.current ||
      drawControlRef.current?._toolbars?.draw?._modes?.polygon?.handler ||
      null;

    if (!handler) {
      console.error('finishPolygon: не найден активный обработчик рисования полигона');
      alert('Не найден активный инструмент рисования. Попробуйте начать рисовать зону заново.');
      return;
    }

    const markerCount = handler._markers ? handler._markers.length : 0;
    if (markerCount < 3) {
      alert('Нужно минимум 3 точки, чтобы завершить фигуру');
      return;
    }
    handler.completeShape();
  }

  async function autoLayout() {
    const input = window.prompt('Размер сетки зон (N×N):', '4');
    if (input === null) return;
    const n = parseInt(input, 10);
    if (!Number.isFinite(n) || n < 1 || n > 20) {
      alert('Введите целое число от 1 до 20');
      return;
    }

    if (zonesCountRef.current > 0) {
      const ok = window.confirm(
        `Уже есть сохранённые зоны (${zonesCountRef.current}). Авторазметка удалит их все и создаст новую сетку. Продолжить?`
      );
      if (!ok) return;
    }

    const drawnItems = drawnItemsRef.current;
    if (!drawnItems) return;

    const sellerId = await getSellerId();
    if (!sellerId) {
      alert('Не удалось определить продавца, обновите страницу и попробуйте снова');
      return;
    }

    if (zonesCountRef.current > 0) {
      const { error: delError } = await supabase
        .from('zones')
        .delete()
        .eq('seller_id', sellerId);
      if (delError) {
        alert('Ошибка удаления старых зон: ' + delError.message);
        return;
      }
      drawnItems.clearLayers();
      layerMetaRef.current.clear();
      zoneLayersRef.current.clear();
      setZonesCount(() => 0);
    }

    const cells = buildGridCells(n);
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      const name = `Зона ${i + 1}`;
      const color = PALETTE[i % PALETTE.length];
      const geojson = cellToGeoJSON(cell);

      const { data, error } = await supabase
        .from('zones')
        .insert({ seller_id: sellerId, name, coordinates: geojson, color })
        .select('id')
        .single();

      if (error || !data) {
        console.error('Ошибка сохранения зоны сетки:', error);
        continue;
      }

      const layer = L.polygon(cell, { color, weight: 2, fillOpacity: 0.35 });
      drawnItems.addLayer(layer);
      zoneLayersRef.current.set(data.id, layer);
      attachZoneInteractions(layer, data.id, name);
    }

    setZonesCount(() => cells.length);
  }

  return (
    <div className="relative w-full h-[calc(100vh-64px)]">
      <div ref={containerRef} className="w-full h-full" />

      {initError && (
        <div className="absolute top-3 left-3 right-3 z-[2000] bg-red-50 border border-red-300
          text-red-700 rounded-lg shadow-lg px-4 py-3 text-sm">
          <b>Не удалось загрузить инструмент рисования зон:</b> {initError}
        </div>
      )}

      {showFinishBtn && (
        <button
          onClick={finishPolygon}
          className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-blue-600 text-white
            px-4 py-2 rounded-lg shadow-lg font-semibold hover:bg-blue-700"
        >
          ✓ Завершить фигуру
        </button>
      )}

      <button
        onClick={autoLayout}
        className="absolute bottom-4 right-4 z-[1000] bg-white px-4 py-2 rounded-xl shadow-lg
          font-bold hover:bg-gray-50"
      >
        🎯 Авторазметка зон
      </button>

      <div className="absolute bottom-4 left-3 z-[1000] bg-white rounded-xl shadow-lg px-3 py-2 text-xs text-gray-500">
        Зон сохранено: {zonesCount}
      </div>
    </div>
  );
}
