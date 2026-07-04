'use client'

import { useEffect, useRef, useState } from 'react'

export interface MapPoint {
  id: string
  lat: number
  lng: number
  order_number: string
  client_address: string
  client_phone: string
  status: string
  price: number
}

export interface MapGLProps {
  points: MapPoint[]
  center?: [number, number]
  zoom?: number
  height?: string
  // Кастомные цвета маркеров по статусу — нужно на /courier-map, где статусов
  // (стадий курьера) пять, а не три как в статусах заказа продавца.
  // Если не передать — используются цвета по умолчанию для статусов заказа.
  statusColors?: Record<string, string>
  // id точки, которую нужно подсветить (например, выбранная в списке слева карточка)
  selectedId?: string | null
  onPointClick?: (point: MapPoint) => void
}

const DEFAULT_STATUS_COLORS: Record<string, string> = {
  pending: '#F59E0B',
  in_transit: '#3B82F6',
  delivered: '#10B981',
}

// Разумные пределы Алматы — точки с некорректными координатами (null, 0, или
// в другом городе/за пределами страны из-за битых данных) не должны попадать
// в маркеры и тем более влиять на масштаб карты.
const ALMATY_BOUNDS = {
  latMin: 43.0,
  latMax: 43.5,
  lngMin: 76.5,
  lngMax: 77.3,
}

function isValidAlmatyPoint(point: MapPoint) {
  return (
    !!point.lat &&
    !!point.lng &&
    point.lat >= ALMATY_BOUNDS.latMin &&
    point.lat <= ALMATY_BOUNDS.latMax &&
    point.lng >= ALMATY_BOUNDS.lngMin &&
    point.lng <= ALMATY_BOUNDS.lngMax
  )
}

function buildMarkerIcon(color: string, selected: boolean) {
  const width = selected ? 40 : 32
  const height = selected ? 50 : 40
  const ring = selected ? '<circle cx="16" cy="16" r="14" fill="none" stroke="white" stroke-width="3"/>' : ''

  return (
    'data:image/svg+xml;base64,' +
    btoa(
      `<svg width="${width}" height="${height}" viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg">` +
        `<path d="M16 0C7.163 0 0 7.163 0 16C0 28 16 40 16 40C16 40 32 28 32 16C32 7.163 24.837 0 16 0Z" fill="${color}"/>` +
        ring +
        '<circle cx="16" cy="16" r="7" fill="white"/>' +
        '</svg>',
    )
  )
}

export function MapGL({
  points,
  center = [76.889709, 43.238949],
  zoom = 12,
  height = '500px',
  statusColors,
  selectedId,
  onPointClick,
}: MapGLProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const mapglRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const [mapError, setMapError] = useState(false)
  const [mapLoading, setMapLoading] = useState(true)
  const [mapReady, setMapReady] = useState(false)

  const colors = statusColors ?? DEFAULT_STATUS_COLORS

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

  // Обновление маркеров — при каждом изменении списка точек, цветов или выбранной точки
  useEffect(() => {
    if (!mapReady || !mapRef.current || !mapglRef.current) return

    // Удаляем старые маркеры
    markersRef.current.forEach((m) => {
      try {
        m.destroy()
      } catch {}
    })
    markersRef.current = []

    // Создаём новые маркеры — только для точек с корректными координатами в пределах Алматы
    points.filter(isValidAlmatyPoint).forEach((point) => {
      const isSelected = point.id === selectedId
      const svgIcon = buildMarkerIcon(colors[point.status] || '#EF4444', isSelected)

      const marker = new mapglRef.current.Marker(mapRef.current, {
        coordinates: [point.lng, point.lat],
        icon: svgIcon,
        anchor: isSelected ? [20, 50] : [16, 40],
      })

      marker.on('click', () => {
        if (onPointClick) onPointClick(point)
      })

      markersRef.current.push(marker)
    })
  }, [mapReady, points, colors, selectedId, onPointClick])

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

export default MapGL
