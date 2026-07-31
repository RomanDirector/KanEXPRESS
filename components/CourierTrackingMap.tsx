'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '@/lib/supabase';
import { useLang } from '@/lib/i18n';
import { getSellerCourierIds } from '@/lib/couriers';

const ALMATY_CENTER: [number, number] = [43.238949, 76.889709];
const DEFAULT_ZOOM = 11;
const OFFLINE_MINUTES = 15;

interface Courier {
  id: string;
  full_name: string;
  phone: string;
  status: string;
  current_lat: number | null;
  current_lng: number | null;
  location_updated_at: string | null;
}

interface OrderPoint {
  id: string;
  order_number: string;
  lat: number;
  lng: number;
  courier_name: string | null;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
  const { t } = useLang();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const courierMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const activeCountsRef = useRef<Map<string, number>>(new Map());
  const sellerIdRef = useRef<string | null>(null);
  const sellerCourierIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current).setView(ALMATY_CENTER, DEFAULT_ZOOM);
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    init(map);

    const channel = supabase
      .channel('couriers-live')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'couriers' },
        (payload) => {
          const c = payload.new as Courier;
          // couriers — общая таблица без seller_id, поэтому realtime-фильтр по колонке
          // невозможен; отсекаем чужих курьеров вручную по уже загруженному набору id.
          if (c && sellerCourierIdsRef.current.has(c.id) && c.current_lat != null && c.current_lng != null) {
            upsertCourierMarker(map, c);
          }
        }
      )
      .subscribe();

    const interval = setInterval(() => refreshAll(map), 60_000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function init(map: L.Map) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    sellerIdRef.current = user.id;

    const { data: orderRows } = await supabase
      .from('orders')
      .select('id, order_number, lat, lng, courier_name, status')
      .eq('seller_id', user.id)
      .eq('status', 'in_transit')
      .not('lat', 'is', null)
      .not('lng', 'is', null);

      if (mapRef.current !== map) return;

    const orders = (orderRows || []) as OrderPoint[];
    const counts = new Map<string, number>();

    orders.forEach((o) => {
      if (o.courier_name) counts.set(o.courier_name, (counts.get(o.courier_name) || 0) + 1);
      L.marker([o.lat, o.lng], { icon: orderIcon() })
        .bindTooltip(t('orderMarkerTitle').replace('{number}', o.order_number))
        .addTo(map);
    });

    activeCountsRef.current = counts;

    await refreshAll(map);
  }

  async function refreshAll(map: L.Map) {
    if (!sellerIdRef.current) return;
    const courierIds = await getSellerCourierIds(sellerIdRef.current);
    sellerCourierIdsRef.current = new Set(courierIds);
    if (courierIds.length === 0) return;

    const { data: couriers } = await supabase
      .from('couriers')
      .select('id, full_name, phone, status, current_lat, current_lng, location_updated_at')
      .in('id', courierIds)
      .not('current_lat', 'is', null)
      .not('current_lng', 'is', null);

      if (mapRef.current !== map) return;

    (couriers || []).forEach((c: Courier) => upsertCourierMarker(map, c));
  }

  function upsertCourierMarker(map: L.Map, c: Courier) {
    if (mapRef.current !== map) return;
    if (c.current_lat == null || c.current_lng == null) return;

    const ageMin = c.location_updated_at
      ? (Date.now() - new Date(c.location_updated_at).getTime()) / 60000
      : Infinity;
    const offline = ageMin > OFFLINE_MINUTES;
    const activeOrders = activeCountsRef.current.get(c.full_name) || 0;
    const waPhone = (c.phone || '').replace(/[^\d]/g, '');

    const popupHtml = `
      <div style="min-width:200px">
        <b>${escapeHtml(c.full_name)}</b> ${offline ? `<span style="color:#999">${t('offlineLabel')}</span>` : ''}<br/>
        ${c.phone ? `📞 ${escapeHtml(c.phone)}<br/>` : ''}
        📦 ${t('activeOrdersLabel')} <b>${activeOrders}</b><br/>
        ${waPhone ? `<a href="https://wa.me/${waPhone}" target="_blank" style="color:#16a34a;font-weight:600">WhatsApp</a>` : ''}
      </div>`;

    const existing = courierMarkersRef.current.get(c.id);
    if (existing) {
      existing.setLatLng([c.current_lat, c.current_lng]);
      existing.setIcon(courierIcon(offline));
      existing.setPopupContent(popupHtml);
    } else {
      const marker = L.marker([c.current_lat, c.current_lng], { icon: courierIcon(offline) })
        .bindPopup(popupHtml)
        .addTo(map);
      courierMarkersRef.current.set(c.id, marker);
    }
  }

  return (
    <div className="relative w-full h-[calc(100vh-160px)] rounded-2xl overflow-hidden">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
