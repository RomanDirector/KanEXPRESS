'use client'

import { useEffect, useRef, useState } from 'react'
import { load } from '@2gis/mapgl'
import { supabase } from '@/lib/supabase'
import { useLang } from '@/lib/i18n'

const ALMATY_CENTER: [number, number] = [76.889709, 43.238949]
const KEY = process.env.NEXT_PUBLIC_2GIS_KEY || ''
const OFFLINE_MINUTES = 15

interface Courier {
  id: string
  full_name: string
  phone: string
  status: string
  current_lat: number | null
  current_lng: number | null
  location_updated_at: string | null
}

export default function CourierTrackingMap2GIS() {
  const { t } = useLang()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any>(null)
  const mapglRef = useRef<any>(null)
  const courierMarkersRef = useRef<Map<string, any>>(new Map())
  const orderMarkersRef = useRef<any[]>([])
  const activeCountsRef = useRef<Map<string, number>>(new Map())

  const [popup, setPopup] = useState<{ name: string; phone: string; orders: number; offline: boolean } | null>(null)

  useEffect(() => {
    let destroyed = false
    let channel: ReturnType<typeof supabase.channel> | null = null
    let interval: ReturnType<typeof setInterval> | null = null

    load().then((mapgl) => {
      if (destroyed || !containerRef.current) return
      mapglRef.current = mapgl

      const map = new mapgl.Map(containerRef.current, { center: ALMATY_CENTER, zoom: 11, key: KEY, enableTrackResize: true })
      mapRef.current = map

      init()

      // Realtime на саму таблицу couriers — она обновляется при каждом изменении координат
      channel = supabase
        .channel('couriers-live')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'couriers' }, (payload) => {
          const c = payload.new as Courier
          if (c && c.current_lat != null && c.current_lng != null) upsertCourierMarker(c)
        })
        .subscribe()

      interval = setInterval(refreshAll, 60_000)
    })

    return () => {
      destroyed = true
      if (channel) supabase.removeChannel(channel)
      if (interval) clearInterval(interval)
      courierMarkersRef.current.forEach((m) => m.destroy())
      courierMarkersRef.current.clear()
      orderMarkersRef.current.forEach((m) => m.destroy())
      orderMarkersRef.current = []
      mapRef.current?.destroy()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function init() {
    const { data: orderRows } = await supabase
      .from('orders')
      .select('id, order_number, lat, lng, courier_name, status')
      .eq('status', 'in_transit')
      .not('lat', 'is', null)
      .not('lng', 'is', null)

    const counts = new Map<string, number>()
    const mapgl = mapglRef.current
    const map = mapRef.current
    if (!mapgl || !map) return

    ;(orderRows || []).forEach((o: any) => {
      if (o.courier_name) counts.set(o.courier_name, (counts.get(o.courier_name) || 0) + 1)
      const m = new mapgl.HtmlMarker(map, {
        coordinates: [o.lng, o.lat],
        html: `<div title="${t('orderMarkerTitle').replace('{number}', o.order_number)}" style="width:14px;height:14px;border-radius:50%;background:#f59e0b;border:3px solid #2563eb;box-shadow:0 1px 3px rgba(0,0,0,.4);cursor:pointer;"></div>`,
        anchor: [7, 7],
      })
      orderMarkersRef.current.push(m)
    })
    activeCountsRef.current = counts

    await refreshAll()
  }

  async function refreshAll() {
    const { data: couriers } = await supabase
      .from('couriers')
      .select('id, full_name, phone, status, current_lat, current_lng, location_updated_at')
      .not('current_lat', 'is', null)
      .not('current_lng', 'is', null)

    ;(couriers || []).forEach((c: Courier) => upsertCourierMarker(c))
  }

  function upsertCourierMarker(c: Courier) {
    const mapgl = mapglRef.current
    const map = mapRef.current
    if (!mapgl || !map || c.current_lat == null || c.current_lng == null) return

    const ageMin = c.location_updated_at
      ? (Date.now() - new Date(c.location_updated_at).getTime()) / 60000
      : Infinity
    const offline = ageMin > OFFLINE_MINUTES
    const activeOrders = activeCountsRef.current.get(c.full_name) || 0

    courierMarkersRef.current.get(c.id)?.destroy()

    const marker = new mapgl.HtmlMarker(map, {
      coordinates: [c.current_lng, c.current_lat],
      html: `<div style="font-size:26px;cursor:pointer;filter:drop-shadow(0 1px 2px rgba(0,0,0,.4));opacity:${offline ? 0.4 : 1};">🚚</div>`,
      anchor: [13, 13],
    })

    const el = (marker as any).getContent?.() as HTMLElement | undefined
    if (el) el.onclick = () => setPopup({ name: c.full_name, phone: c.phone, orders: activeOrders, offline })

    courierMarkersRef.current.set(c.id, marker)
  }

  return (
    <div className="relative w-full h-[calc(100vh-160px)] rounded-2xl overflow-hidden">
      <div ref={containerRef} className="w-full h-full" />
      {popup && (
        <div className="absolute top-3 right-3 z-10 bg-white rounded-xl shadow-lg p-4 w-64">
          <p className="font-bold">🚚 {popup.name} {popup.offline && <span className="text-gray-400 text-xs">{t('offlineLabel')}</span>}</p>
          {popup.phone && <p className="text-sm text-gray-600 mt-1">📞 {popup.phone}</p>}
          <p className="text-sm text-gray-600 mt-1">📦 {t('activeOrdersLabel')} <b>{popup.orders}</b></p>
          <div className="flex gap-2 mt-3">
            {popup.phone && (
              <a href={`https://wa.me/${popup.phone.replace(/[^\d]/g, '')}`} target="_blank" className="flex-1 text-center px-3 py-2 rounded-lg bg-green-600 text-white text-sm font-bold">WhatsApp</a>
            )}
            <button onClick={() => setPopup(null)} className="px-3 py-2 rounded-lg border text-sm text-gray-600">{t('close')}</button>
          </div>
        </div>
      )}
    </div>
  )
}