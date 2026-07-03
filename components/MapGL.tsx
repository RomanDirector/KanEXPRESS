'use client'

import { useEffect, useRef, useState } from 'react'

interface MapPoint {
  id: string
  lat: number
  lng: number
  order_number: string
  client_address: string
  client_phone: string
  status: string
  price: number
}

interface MapGLProps {
  points: MapPoint[]
  center?: [number, number]
  zoom?: number
  height?: string
  onPointClick?: (point: MapPoint) => void
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#F59E0B',
  in_transit: '#3B82F6',
  delivered: '#10B981',
}

export default function MapGL({
  points,
  center = [76.889709, 43.238949],
  zoom = 12,
  height = '500px',
  onPointClick,
}: MapGLProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const mapglRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const [mapError, setMapError] = useState(false)
  const [mapLoading, setMapLoading] = useState(true)
  const [mapReady, setMapReady] = useState(false)

  // Инициализация карты — один раз
  useEffect(() => {
    if (!containerRef.current) return

    let destroyed = false

    const initMap = async () => {
      try {
        const mapglModule = await import('@2gis/mapgl')
        const mapgl = await mapglModule.load()

        if (destroyed || !containerRef.current) return

        const map = new mapgl.Map(containerRef.current, {
          center,
          zoom,
          key: process.env.NEXT_PUBLIC_2GIS_KEY || '',
        })

        mapRef.current = map
        mapglRef.current = mapgl
        setMapLoading(false)
        setMapReady(true)
      } catch (err) {
        console.error('2GIS map error:', err)
        setMapError(true)
        setMapLoading(false)
      }
    }

    initMap()

    return () => {
      destroyed = true
      markersRef.current.forEach((m) => {
        try {
          m.destroy()
        } catch {}
      })
      markersRef.current = []
      if (mapRef.current) {
        try {
          mapRef.current.destroy()
        } catch {}
        mapRef.current = null
      }
    }
  }, [])

  // Обновление маркеров — при каждом изменении списка точек
  useEffect(() => {
    if (!mapReady || !mapRef.current || !mapglRef.current) return

    // Удаляем старые маркеры
    markersRef.current.forEach((m) => {
      try {
        m.destroy()
      } catch {}
    })
    markersRef.current = []

    // Создаём новые маркеры
    points.forEach((point) => {
      if (!point.lat || !point.lng) return

      const svgIcon =
        'data:image/svg+xml;base64,' +
        btoa(
          '<svg width="32" height="40" viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg">' +
            '<path d="M16 0C7.163 0 0 7.163 0 16C0 28 16 40 16 40C16 40 32 28 32 16C32 7.163 24.837 0 16 0Z" fill="' +
            (STATUS_COLORS[point.status] || '#EF4444') +
            '"/>' +
            '<circle cx="16" cy="16" r="7" fill="white"/>' +
            '</svg>'
        )

      const marker = new mapglRef.current.Marker(mapRef.current, {
        coordinates: [point.lng, point.lat],
        icon: svgIcon,
        anchor: [16, 40],
      })

      marker.on('click', () => {
        if (onPointClick) onPointClick(point)
      })

      markersRef.current.push(marker)
    })
  }, [mapReady, points])

  if (mapError) {
    return (
      <div
        className="rounded-2xl bg-gray-100 flex flex-col items-center justify-center gap-3"
        style={{ height }}
      >
        <p className="text-gray-500 text-sm font-medium">Карта недоступна</p>
        <p className="text-gray-400 text-xs">Проверьте API ключ 2GIS в .env.local</p>
        <p className="text-gray-400 text-xs">NEXT_PUBLIC_2GIS_KEY=ваш_ключ</p>
      </div>
    )
  }

  return (
    <div className="relative rounded-2xl overflow-hidden" style={{ height }}>
      {mapLoading && (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center z-10 rounded-2xl">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-400 text-sm">Загружаем карту...</p>
          </div>
        </div>
      )}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}