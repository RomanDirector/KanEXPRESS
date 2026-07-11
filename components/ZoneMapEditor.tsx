'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet-draw';
import { supabase } from '@/lib/supabase';

const ALMATY_CENTER: [number, number] = [43.238949, 76.889709];
const DEFAULT_ZOOM = 11;

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

export default function ZoneMapEditor() {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const drawnItemsRef = useRef<L.FeatureGroup | null>(null);
  const layerToZoneRef = useRef<Map<number, string>>(new Map());

  const [pendingLayer, setPendingLayer] = useState<L.Polygon | null>(null);
  const [zoneName, setZoneName] = useState('');
  const [saving, setSaving] = useState(false);
  const [zonesCount, setZonesCount] = useState(0);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current).setView(ALMATY_CENTER, DEFAULT_ZOOM);
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    const drawnItems = new L.FeatureGroup();
    drawnItemsRef.current = drawnItems;
    map.addLayer(drawnItems);

    const drawControl = new (L.Control as any).Draw({
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

    const CityButton = L.Control.extend({
      options: { position: 'bottomright' },
      onAdd: () => {
        const btn = L.DomUtil.create('button', '');
        btn.innerText = 'АЛМАТЫ';
        btn.style.cssText =
          'background:#2563eb;color:#fff;border:none;padding:8px 16px;' +
          'border-radius:6px;font-weight:700;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.3)';
        btn.onclick = () => map.setView(ALMATY_CENTER, DEFAULT_ZOOM);
        return btn;
      },
    });
    map.addControl(new CityButton());

    loadExistingZones(drawnItems);

    map.on((L as any).Draw.Event.CREATED, (e: any) => {
      const layer = e.layer as L.Polygon;
      drawnItems.addLayer(layer);
      setPendingLayer(layer);
      setZoneName('');
    });

    map.on((L as any).Draw.Event.EDITED, (e: any) => {
      const layers = e.layers as L.LayerGroup;
      layers.eachLayer(async (layer: any) => {
        const zoneId = layerToZoneRef.current.get(L.Util.stamp(layer));
        if (!zoneId) return;
        const geojson = layer.toGeoJSON().geometry;
        const { error } = await supabase
          .from('zones')
          .update({ coordinates: geojson })
          .eq('id', zoneId);
        if (error) alert('Ошибка сохранения изменений: ' + error.message);
      });
    });

    map.on((L as any).Draw.Event.DELETED, (e: any) => {
      const layers = e.layers as L.LayerGroup;
      layers.eachLayer(async (layer: any) => {
        const zoneId = layerToZoneRef.current.get(L.Util.stamp(layer));
        if (!zoneId) return;
        const { error } = await supabase.from('zones').delete().eq('id', zoneId);
        if (error) alert('Ошибка удаления: ' + error.message);
        else {
          layerToZoneRef.current.delete(L.Util.stamp(layer));
          setZonesCount((c) => Math.max(0, c - 1));
        }
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  async function loadExistingZones(drawnItems: L.FeatureGroup) {
    const { data, error } = await supabase
      .from('zones')
      .select('id, name, color, coordinates')
      .order('created_at');

    if (error) {
      console.error('Ошибка загрузки зон:', error);
      return;
    }

    const zones = (data || []) as ZoneRow[];
    setZonesCount(zones.length);

    zones.forEach((zone, i) => {
      const color = zone.color || PALETTE[i % PALETTE.length];
      try {
        const latlngs = zone.coordinates.coordinates[0].map(
          ([lng, lat]) => [lat, lng] as [number, number]
        );
        const polygon = L.polygon(latlngs, {
          color,
          weight: 2,
          fillOpacity: 0.35,
        });
        polygon.bindPopup(
          `<b>${zone.name}</b><br/><small>Редактирование — панель слева (карандаш/корзина)</small>`
        );
        drawnItems.addLayer(polygon);
        layerToZoneRef.current.set(L.Util.stamp(polygon), zone.id);
      } catch (e) {
        console.error('Не удалось отрисовать зону', zone.name, e);
      }
    });
  }

  async function saveZone() {
    if (!pendingLayer || !zoneName.trim()) return;
    setSaving(true);

    const geojson = (pendingLayer.toGeoJSON() as any).geometry;
    const color = PALETTE[zonesCount % PALETTE.length];

    const { data: userData } = await supabase.auth.getUser();
    const sellerId = userData?.user?.id;

    const { data, error } = await supabase
      .from('zones')
      .insert({
        seller_id: sellerId,
        name: zoneName.trim(),
        coordinates: geojson,
        color,
      })
      .select('id')
      .single();

    setSaving(false);

    if (error || !data) {
      alert('Ошибка сохранения зоны: ' + (error?.message || 'unknown'));
      return;
    }

    pendingLayer.setStyle({ color, weight: 2, fillOpacity: 0.35 });
    pendingLayer.bindPopup(`<b>${zoneName.trim()}</b>`);
    layerToZoneRef.current.set(L.Util.stamp(pendingLayer), data.id);
    setZonesCount((c) => c + 1);
    setPendingLayer(null);
    setZoneName('');
  }

  function cancelZone() {
    if (pendingLayer && drawnItemsRef.current) {
      drawnItemsRef.current.removeLayer(pendingLayer);
    }
    setPendingLayer(null);
    setZoneName('');
  }

  return (
    <div className="relative w-full h-[calc(100vh-64px)]">
      <div ref={containerRef} className="w-full h-full" />

      {pendingLayer && (
        <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl p-6 w-96 shadow-2xl">
            <h3 className="text-lg font-bold mb-3">Название района</h3>
            <input
              autoFocus
              value={zoneName}
              onChange={(e) => setZoneName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveZone()}
              placeholder="Например: Бостандыкский"
              className="w-full border rounded-lg px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={cancelZone}
                className="px-4 py-2 rounded-lg border text-gray-600 hover:bg-gray-50"
              >
                Отмена
              </button>
              <button
                onClick={saveZone}
                disabled={saving || !zoneName.trim()}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Сохраняю…' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}