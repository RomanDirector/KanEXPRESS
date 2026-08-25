'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet-draw';
import { supabase } from '@/lib/supabase';
import { Toast } from '@/components/Toast';
import { friendlyDbError } from '@/lib/db-errors';
import { buildWarehouseIcon } from '@/lib/map-icons';

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

// Одна "визуальная" зона на карте = N строк zones (по одной на продавца) с
// одинаковыми coordinates/name/color и общим zone_group_id (см. миграцию
// 2026-08-shared-zones.sql). Компонент читает/пишет всегда по группе, а не
// по id конкретной строки — так правки на карте применяются сразу ко всем
// продавцам.
interface ZoneRow {
  id: string;
  name: string;
  color: string;
  coordinates: GeoJSON.Polygon;
  display_number: number | null;
  zone_group_id: string;
  created_at: string;
}

interface ZoneMeta {
  groupId: string;
  name: string;
}

export interface OrderPoint {
  id: string;
  order_number: string;
  client_address: string;
  lat: number;
  lng: number;
  status: string;
}

// Те же цвета статусов, что и на "Карте" (components/MapGL.tsx DEFAULT_STATUS_COLORS / orders-map).
const ORDER_STATUS_COLORS: Record<string, string> = {
  pending: '#F59E0B',
  in_transit: '#3B82F6',
  delivered: '#10B981',
};

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildPopupHtml(groupId: string, name: string, deleteLabel: string) {
  return `
    <div style="min-width:160px">
      <b>${escapeHtml(name)}</b><br/>
      <button data-delete-zone="${groupId}"
        style="margin-top:6px;background:#dc2626;color:#fff;border:none;
        padding:5px 12px;border-radius:6px;font-weight:600;cursor:pointer">
        ${escapeHtml(deleteLabel)}</button>
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

// Единственный вызывающий — app/admin/zones, где весь остальной UI
// захардкожен на русском (админ-панель не многоязычная, см.
// app/admin/layout.tsx) — поэтому здесь тоже прямые русские строки вместо
// useLang()/t(): раньше компонент жил и на многоязычной странице продавца,
// но с переносом в админку прежние переводы стали недостижимы, а обёртка
// в LangProvider ради одного компонента рисковала протащить в админку
// казахский язык из localStorage, оставшийся от сессии продавца в том же
// браузере. Зона всегда общая для всех продавцов: рисуется/редактируется
// один раз, а под капотом это N строк zones (по одной на продавца, см.
// buildInsertRows) с общим zone_group_id.
export default function ZoneMapEditor({ orders = [] }: { orders?: OrderPoint[] }) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const drawnItemsRef = useRef<L.FeatureGroup | null>(null);
  const orderLayerRef = useRef<L.LayerGroup | null>(null);
  const warehouseMarkersRef = useRef<L.Marker[]>([]);
  const drawControlRef = useRef<any>(null);
  const polygonHandlerRef = useRef<any>(null);

  const zoneLayersRef = useRef<Map<string, L.Polygon>>(new Map());
  const layerMetaRef = useRef<Map<number, ZoneMeta>>(new Map());
  const zonesCountRef = useRef(0);

  const [zonesCount, setZonesCountState] = useState(0);
  const [showFinishBtn, setShowFinishBtn] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  function setZonesCount(updater: (c: number) => number) {
    zonesCountRef.current = updater(zonesCountRef.current);
    setZonesCountState(zonesCountRef.current);
  }

  // Строки для bulk-insert новой/пересозданной группы — одна строка на
  // каждого существующего продавца, все с одним zone_group_id.
  async function buildInsertRows(groupId: string, name: string, coordinates: GeoJSON.Polygon, color: string) {
    const { data: sellersData, error } = await supabase.from('sellers').select('id');
    if (error || !sellersData || sellersData.length === 0) return null;
    return sellersData.map((s: { id: string }) => ({
      seller_id: s.id,
      name,
      coordinates,
      color,
      zone_group_id: groupId,
    }));
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
      await loadExistingZones();
      await loadWarehouseMarkers();
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

      const geojson = (layer.toGeoJSON() as any).geometry;
      const color = PALETTE[zonesCountRef.current % PALETTE.length];
      const groupId = crypto.randomUUID();

      const rows = await buildInsertRows(groupId, trimmed, geojson, color);
      if (!rows) {
        setToast({ message: 'Не удалось создать зону: в системе нет ни одного продавца', type: 'error' });
        return;
      }

      const { error } = await supabase.from('zones').insert(rows);

      if (error) {
        console.error('Ошибка сохранения зоны:', error);
        setToast({ message: friendlyDbError(error, 'Не удалось сохранить зону, попробуйте снова'), type: 'error' });
        return;
      }

      layer.setStyle({ color, weight: 2, fillOpacity: 0.35 });
      drawnItems.addLayer(layer);
      zoneLayersRef.current.set(groupId, layer);
      attachZoneInteractions(layer, groupId, trimmed);
      setZonesCount((c) => c + 1);
      setToast({ message: 'Зона успешно сохранена', type: 'success' });
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
          .eq('zone_group_id', meta.groupId);
        if (error) {
          console.error('Ошибка сохранения изменений зоны:', error);
          setToast({ message: friendlyDbError(error, 'Не удалось сохранить изменения зоны'), type: 'error' });
        }
      });
    });

    map.on((L as any).Draw.Event.DELETED, (e: any) => {
      const layers = e.layers as L.LayerGroup;
      layers.eachLayer(async (layer: any) => {
        const stamp = L.Util.stamp(layer);
        const meta = layerMetaRef.current.get(stamp);
        if (!meta) return;
        const { error } = await supabase
          .from('zones')
          .delete()
          .eq('zone_group_id', meta.groupId);
        if (error) {
          console.error('Ошибка удаления зоны:', error);
          setToast({ message: friendlyDbError(error, 'Не удалось удалить зону'), type: 'error' });
          return;
        }
        layerMetaRef.current.delete(stamp);
        zoneLayersRef.current.delete(meta.groupId);
        setZonesCount((c) => Math.max(0, c - 1));
      });
    });

    map.on('popupopen', (e: any) => {
      const el = e.popup.getElement();
      const btn = el?.querySelector('[data-delete-zone]') as HTMLElement | null;
      if (btn) {
        btn.onclick = () => {
          const groupId = btn.getAttribute('data-delete-zone')!;
          deleteZone(groupId);
        };
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
      // Слой с точками заказов был привязан к этому экземпляру карты (StrictMode
      // в dev монтирует эффект дважды) — без сброса следующий рендер добавлял бы
      // маркеры в уже уничтоженный, отвязанный от карты layerGroup.
      orderLayerRef.current = null;
      warehouseMarkersRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Точки заказов поверх зон — просто наложение, к рисованию/редактированию зон не относится.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!orderLayerRef.current) {
      orderLayerRef.current = L.layerGroup().addTo(map);
    } else {
      orderLayerRef.current.clearLayers();
    }

    orders.forEach((order) => {
      const color = ORDER_STATUS_COLORS[order.status] || '#EF4444';
      const marker = L.circleMarker([order.lat, order.lng], {
        radius: 8,
        color: 'white',
        weight: 2,
        fillColor: color,
        fillOpacity: 1,
      });
      marker.bindPopup(
        `<div style="min-width:160px"><b>${escapeHtml(order.order_number)}</b><br/>${escapeHtml(order.client_address)}</div>`
      );
      orderLayerRef.current!.addLayer(marker);
    });
  }, [orders]);

  function attachZoneInteractions(layer: L.Polygon, groupId: string, name: string) {
    layerMetaRef.current.set(L.Util.stamp(layer), { groupId, name });
    layer.bindTooltip(name, { direction: 'center', className: 'zone-tooltip' });
    layer.bindPopup(buildPopupHtml(groupId, name, '🗑 Удалить зону'));

    layer.on('dblclick', (e: any) => {
      L.DomEvent.stop(e);
      const meta = layerMetaRef.current.get(L.Util.stamp(layer));
      if (!meta) return;
      const newName = window.prompt('Новое название зоны:', meta.name);
      if (newName === null) return;
      const trimmed = newName.trim();
      if (!trimmed || trimmed === meta.name) return;
      renameZone(layer, meta.groupId, trimmed);
    });
  }

  async function renameZone(layer: L.Polygon, groupId: string, newName: string) {
    const { error } = await supabase
      .from('zones')
      .update({ name: newName })
      .eq('zone_group_id', groupId);
    if (error) {
      console.error('Ошибка переименования зоны:', error);
      setToast({ message: friendlyDbError(error, 'Не удалось переименовать зону'), type: 'error' });
      return;
    }
    layerMetaRef.current.set(L.Util.stamp(layer), { groupId, name: newName });
    layer.setTooltipContent(newName);
    layer.setPopupContent(buildPopupHtml(groupId, newName, '🗑 Удалить зону'));
  }

  async function deleteZone(groupId: string) {
    if (!window.confirm('Удалить эту зону?')) return;

    const { error } = await supabase
      .from('zones')
      .delete()
      .eq('zone_group_id', groupId);
    if (error) {
      console.error('Ошибка удаления зоны:', error);
      setToast({ message: friendlyDbError(error, 'Не удалось удалить зону'), type: 'error' });
      return;
    }

    const layer = zoneLayersRef.current.get(groupId);
    if (layer) {
      drawnItemsRef.current?.removeLayer(layer);
      layerMetaRef.current.delete(L.Util.stamp(layer));
      zoneLayersRef.current.delete(groupId);
    }
    setZonesCount((c) => Math.max(0, c - 1));
  }

  // Одна логическая зона может иметь несколько строк zones (по одной на
  // продавца, все с одинаковыми coordinates/name/color) — рисуем один
  // полигон на zone_group_id, беря самую раннюю строку группы как образец.
  async function loadExistingZones() {
    const drawnItems = drawnItemsRef.current;
    if (!drawnItems) return;

    const { data, error } = await supabase
      .from('zones')
      .select('id, name, color, coordinates, display_number, zone_group_id, created_at')
      .order('created_at');

    if (error) {
      console.error('Ошибка загрузки зон:', error);
      setToast({ message: 'Не удалось загрузить данные: ' + error.message, type: 'error' });
      return;
    }

    const rows = (data || []) as ZoneRow[];
    const seenGroups = new Set<string>();
    const groups: ZoneRow[] = [];
    for (const row of rows) {
      if (seenGroups.has(row.zone_group_id)) continue;
      seenGroups.add(row.zone_group_id);
      groups.push(row);
    }

    groups.forEach((zone, i) => {
      const color = zone.color || PALETTE[i % PALETTE.length];
      try {
        const latlngs = zone.coordinates.coordinates[0].map(
          ([lng, lat]) => [lat, lng] as [number, number]
        );
        const layer = L.polygon(latlngs, { color, weight: 2, fillOpacity: 0.35 });
        drawnItems.addLayer(layer);
        zoneLayersRef.current.set(zone.zone_group_id, layer);
        attachZoneInteractions(layer, zone.zone_group_id, zone.name);
      } catch (e) {
        console.error('Не удалось отрисовать зону', zone.name, e);
      }
    });

    setZonesCount(() => groups.length);
  }

  // Метки складов ВСЕХ продавцов — постоянные, не зависят от зон/заказов и
  // никогда не скрываются фильтрами (их на этой карте и нет). Раньше был один
  // склад текущего продавца; теперь зона общая для всех, поэтому ориентиры
  // на карте тоже показываем для всех продавцов сразу.
  async function loadWarehouseMarkers() {
    const map = mapRef.current;
    if (!map) return;

    const { data, error } = await supabase
      .from('sellers')
      .select('organization_name, warehouse_address, warehouse_lat, warehouse_lng');

    if (error) {
      console.error('Ошибка загрузки адресов складов:', error);
      return;
    }

    warehouseMarkersRef.current.forEach((m) => map.removeLayer(m));
    warehouseMarkersRef.current = [];

    for (const seller of (data || []) as any[]) {
      if (seller.warehouse_lat == null || seller.warehouse_lng == null) continue;
      const marker = L.marker([seller.warehouse_lat, seller.warehouse_lng], {
        icon: buildWarehouseIcon(),
        zIndexOffset: 1000,
      });
      marker.bindPopup(
        `<div style="min-width:160px"><b>${escapeHtml(seller.organization_name || 'Склад')}</b><br/>${escapeHtml(seller.warehouse_address || '')}</div>`
      );
      marker.addTo(map);
      warehouseMarkersRef.current.push(marker);
    }
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

    if (zonesCountRef.current > 0) {
      const { error: delError } = await supabase
        .from('zones')
        .delete()
        .not('id', 'is', null);
      if (delError) {
        console.error('Ошибка удаления старых зон:', delError);
        setToast({ message: friendlyDbError(delError, 'Не удалось удалить старые зоны'), type: 'error' });
        return;
      }
      drawnItems.clearLayers();
      layerMetaRef.current.clear();
      zoneLayersRef.current.clear();
      setZonesCount(() => 0);
    }

    const cells = buildGridCells(n);
    let hadError = false;
    let firstErrorMessage: string | null = null;
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      const name = `Зона ${i + 1}`;
      const color = PALETTE[i % PALETTE.length];
      const geojson = cellToGeoJSON(cell);
      const groupId = crypto.randomUUID();

      const rows = await buildInsertRows(groupId, name, geojson, color);
      if (!rows) {
        hadError = true;
        continue;
      }

      const { error } = await supabase.from('zones').insert(rows);

      if (error) {
        console.error('Ошибка сохранения зоны сетки:', error);
        hadError = true;
        if (!firstErrorMessage) firstErrorMessage = friendlyDbError(error, 'Не удалось сохранить зоны сетки');
        continue;
      }

      const layer = L.polygon(cell, { color, weight: 2, fillOpacity: 0.35 });
      drawnItems.addLayer(layer);
      zoneLayersRef.current.set(groupId, layer);
      attachZoneInteractions(layer, groupId, name);
    }

    setZonesCount(() => cells.length);
    if (hadError) {
      setToast({ message: firstErrorMessage ?? 'Не удалось сохранить изменения, попробуйте снова', type: 'error' });
    } else {
      setToast({ message: 'Зоны успешно созданы', type: 'success' });
    }
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

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
