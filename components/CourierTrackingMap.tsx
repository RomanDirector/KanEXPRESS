'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '@/lib/supabase';

const ALMATY_CENTER: [number, number] = [43.238949, 76.889709];
const OFFLINE_MINUTES = 15;
const ORS_KEY = process.env.NEXT_PUBLIC_ORS_API_KEY || '';

interface Courier {
  id: string;
  name: string;
  phone: string;
}

interface CourierLocation {
  courier_id: string;
  lat: number;
  lng: number;
  updated_at: string;
}

interface OrderPoint {
  id: string;
  number: string;
  lat: number;
  lng: number;
  courier_id: string | null;
}

function courierIcon(offline: boolean) {
  return L.divIcon({
    className: '',
    html: `<div style="font-size:26px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.4));opacity:${offline ? 0.4 : 1};">🚚</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

function orderIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="width:14px;height:14px;border-radius:50%;background:#f59e0b;border:3px solid #2563eb;box-shadow:0 1px 3px rgba(0,0,0,.4);"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

export default function CourierTrackingMap() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const courierMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const couriersRef = useRef<Map<string, Courier>>(new Map());
  const ordersRef = useRef<OrderPoint[]>([]);
  const routeLayerRef = useRef<L.GeoJSON | null>(null);
  const locationsRef = useRef<Map<string, CourierLocation>>(new Map());
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current).setView(ALMATY_CENTER, 11);
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    init(map);

    // Кнопка "Показать маршрут" внутри попапа — вешаем обработчик при открытии
    map.on('popupopen', (e: any) => {
      const el = e.popup.getElement();
      if (!el) return;
      const btn = el.querySelector('[data-route-courier]') as HTMLElement | null;
      if (btn) {
        btn.onclick = () => {
          const courierId = btn.getAttribute('data-route-courier')!;
          drawRoute(map, courierId);
        };
      }
    });

    const channel = supabase
      .channel('courier-locations-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'courier_locations' },
        (payload) => {
          const loc = payload.new as CourierLocation;
          if (loc && loc.courier_id) upsertCourierMarker(map, loc);
        }
      )
      .subscribe();

    const interval = setInterval(() => refreshLocations(map), 60_000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  async function init(map: L.Map) {
    const { data: courierRows } = await supabase
      .from('couriers')
      .select('id, name, phone');
    const cMap = new Map<string, Courier>();
    (courierRows || []).forEach((c: Courier) => cMap.set(c.id, c));
    couriersRef.current = cMap;

    const { data: orderRows } = await supabase
      .from('orders')
      .select('id, number, lat, lng, courier_id')
      .eq('status', 'in_transit')
      .not('lat', 'is', null)
      .not('lng', 'is', null);

    ordersRef.current = (orderRows || []) as OrderPoint[];

    ordersRef.current.forEach((o) => {
      L.marker([o.lat, o.lng], { icon: orderIcon() })
        .bindPopup(`Заказ <b>${o.number}</b> — в пути`)
        .addTo(map);
    });

    await refreshLocations(map);
  }

  async function refreshLocations(map: L.Map) {
    const { data: locs } = await supabase
      .from('courier_locations')
      .select('courier_id, lat, lng, updated_at');
    (locs || []).forEach((loc: CourierLocation) => upsertCourierMarker(map, loc));
  }

  function upsertCourierMarker(map: L.Map, loc: CourierLocation) {
    locationsRef.current.set(loc.courier_id, loc);

    const courier = couriersRef.current.get(loc.courier_id);
    const ageMin = (Date.now() - new Date(loc.updated_at).getTime()) / 60000;
    const offline = ageMin > OFFLINE_MINUTES;

    const name = courier?.name || 'Курьер';
    const phone = courier?.phone || '';
    const activeOrders = ordersRef.current.filter(
      (o) => o.courier_id === loc.courier_id
    ).length;
    const waPhone = phone.replace(/[^\d]/g, '');

    const popupHtml = `
      <div style="min-width:200px">
        <b>${name}</b> ${offline ? '<span style="color:#999">(офлайн)</span>' : ''}<br/>
        ${phone ? `📞 ${phone}<br/>` : ''}
        📦 Активных заказов: <b>${activeOrders}</b><br/>
        ${
          waPhone
            ? `<a href="https://wa.me/${waPhone}" target="_blank" style="color:#16a34a;font-weight:600">WhatsApp</a><br/>`
            : ''
        }
        ${
          activeOrders > 0
            ? `<button data-route-courier="${loc.courier_id}"
                 style="margin-top:6px;background:#2563eb;color:#fff;border:none;
                 padding:5px 12px;border-radius:6px;font-weight:600;cursor:pointer">
                 Показать маршрут</button>`
            : ''
        }
      </div>`;

    const existing = courierMarkersRef.current.get(loc.courier_id);
    if (existing) {
      existing.setLatLng([loc.lat, loc.lng]);
      existing.setIcon(courierIcon(offline));
      existing.setPopupContent(popupHtml);
    } else {
      const marker = L.marker([loc.lat, loc.lng], { icon: courierIcon(offline) })
        .bindPopup(popupHtml)
        .addTo(map);
      courierMarkersRef.current.set(loc.courier_id, marker);
    }
  }

  /** Маршрут курьера по его заказам через OpenRouteService */
  async function drawRoute(map: L.Map, courierId: string) {
    setRouteError(null);

    if (!ORS_KEY) {
      setRouteError(
        'Нет ключа OpenRouteService: добавь NEXT_PUBLIC_ORS_API_KEY в .env.local и перезапусти сервер'
      );
      return;
    }

    const loc = locationsRef.current.get(courierId);
    const orders = ordersRef.current.filter((o) => o.courier_id === courierId);
    if (!loc || orders.length === 0) return;

    setRouteLoading(true);

    // ORS формат координат: [lng, lat]. Старт — курьер, дальше его заказы.
    const coordinates = [
      [loc.lng, loc.lat],
      ...orders.map((o) => [o.lng, o.lat]),
    ];

    try {
      const res = await fetch(
        'https://api.openrouteservice.org/v2/directions/driving-car/geojson',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: ORS_KEY,
          },
          body: JSON.stringify({ coordinates }),
        }
      );

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`ORS ${res.status}: ${text.slice(0, 200)}`);
      }

      const geojson = await res.json();

      if (routeLayerRef.current) {
        map.removeLayer(routeLayerRef.current);
      }

      const layer = L.geoJSON(geojson, {
        style: { color: '#2563eb', weight: 4, opacity: 0.8 },
      }).addTo(map);
      routeLayerRef.current = layer;

      map.fitBounds(layer.getBounds(), { padding: [30, 30] });
    } catch (e: any) {
      console.error('Ошибка маршрута:', e);
      setRouteError('Не удалось построить маршрут: ' + e.message);
    } finally {
      setRouteLoading(false);
    }
  }

  function clearRoute() {
    if (routeLayerRef.current && mapRef.current) {
      mapRef.current.removeLayer(routeLayerRef.current);
      routeLayerRef.current = null;
    }
  }

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="w-full h-[calc(100vh-160px)] rounded-xl overflow-hidden"
      />
      <div className="absolute top-3 right-3 z-[1000] flex flex-col items-end gap-2">
        {routeLoading && (
          <div className="bg-white rounded-lg shadow px-3 py-2 text-sm">
            Строю маршрут…
          </div>
        )}
        {routeError && (
          <div className="bg-red-50 border border-red-300 text-red-700 rounded-lg shadow px-3 py-2 text-sm max-w-xs">
            {routeError}
          </div>
        )}
        <button
          onClick={clearRoute}
          className="bg-white rounded-lg shadow px-3 py-2 text-sm font-semibold hover:bg-gray-50"
        >
          Убрать маршрут
        </button>
      </div>
    </div>
  );
}