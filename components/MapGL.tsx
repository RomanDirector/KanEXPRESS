'use client'

import { useEffect, useRef, useState } from 'react'
import type { CircleMarker as MapglCircleMarker, Map as MapglMap } from '@2gis/mapgl/types'

import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/spinner'

export type OrderStatus = string

export interface MapPoint {
  id: string
  lat: number
  lng: number
  order_number: string
  client_address: string
  client_phone: string
  status: OrderStatus
  price: number
}

interface MapGLProps {
  points: MapPoint[]
  center?: [number, number]
  zoom?: number
  height?: string
  onPointClick?: (point: MapPoint) => void
  statusColors?: Record<string, string>
  selectedId?: string | null
}

const ALMATY_CENTER: [number, number] = [76.889709, 43.238949]

const DEFAULT_STATUS_COLORS: Record<string, string> = {
  pending: '#eab308',
  in_transit: '#3b82f6',
  delivered: '#22c55e',
}

const FALLBACK_COLOR = '#6b7280'

export function MapGL({
  points,
  center = ALMATY_CENTER,
  zoom = 12,
  height = '500px',
  onPointClick,
  statusColors = DEFAULT_STATUS_COLORS,
  selectedId = null,
}: MapGLProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapglMap | null>(null)
  const markersRef = useRef<MapglCircleMarker[]>([])
  const onPointClickRef = useRef(onPointClick)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    onPointClickRef.current = onPointClick
  }, [onPointClick])

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_2GIS_KEY

    if (!key || !containerRef.current) {
      setStatus('error')
      return
    }

    let cancelled = false

    import('@2gis/mapgl')
      .then(({ load }) => load())
      .then((mapglAPI) => {
        if (cancelled || !containerRef.current) return

        const map = new mapglAPI.Map(containerRef.current, {
          center,
          zoom,
          key,
        })

        map.once('idle', () => {
          if (!cancelled) setStatus('ready')
        })

        mapRef.current = map
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })

    return () => {
      cancelled = true
      markersRef.current.forEach((marker) => marker.destroy())
      markersRef.current = []
      mapRef.current?.destroy()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || status !== 'ready') return

    markersRef.current.forEach((marker) => marker.destroy())
    markersRef.current = []

    let cancelled = false

    import('@2gis/mapgl').then(({ load }) =>
      load().then((mapglAPI) => {
        if (cancelled) return

        markersRef.current = points.map((point) => {
          const isSelected = point.id === selectedId
          const marker = new mapglAPI.CircleMarker(map, {
            coordinates: [point.lng, point.lat],
            color: statusColors[point.status] ?? FALLBACK_COLOR,
            diameter: isSelected ? 28 : 20,
          })

          marker.on('click', () => onPointClickRef.current?.(point))

          return marker
        })

        if (selectedId) {
          const selectedPoint = points.find((p) => p.id === selectedId)
          if (selectedPoint) map.setCenter([selectedPoint.lng, selectedPoint.lat])
        }
      }),
    )

    return () => {
      cancelled = true
    }
  }, [points, status, selectedId, statusColors])

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl bg-neutral-100"
      style={{ height }}
    >
      <div ref={containerRef} className="h-full w-full" />

      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-100">
          <Spinner className="size-6 text-neutral-400" />
        </div>
      )}

      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-neutral-100 px-4 text-center text-sm text-neutral-500">
          Карта недоступна, проверьте API ключ 2GIS
        </div>
      )}
    </div>
  )
}
