'use client'

import { useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polygon } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

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

export interface MapZone {
  id: string
  name: string
  color: string
  coordinates: { type: string; coordinates: number[][][] }
}

export interface MapGLProps {
  points: MapPoint[]
  zones?: MapZone[]
  center?: [number, number]
  zoom?: number
  height?: string
  // Кастомные цвета маркеров по статусу — нужно на /courier-map, где статусов
  // (стадий курьера) шесть, а не три как в статусах заказа продавца.
  // Если не передать — используются цвета по умолчанию для статусов заказа.
  statusColors?: Record<string, string>
  // id точки, которую нужно подсветить (например, выбранная в списке слева карточка)
  selectedId?: string | null
  onPointClick?: (point: MapPoint) => void
}

const DEFAULT_STATUS_COLORS: Record<string, string> = {
  // статусы заказа продавца
  pending: '#F59E0B',
  in_transit: '#3B82F6',
  delivered: '#10B981',
  // стадии курьера — используются, если вызывающая страница не передала
  // свой statusColors (обычно передаёт, см. STAGE_MARKER_COLORS на /courier-map)
  not_started: '#9CA3AF',
  departed: '#3B82F6',
  arrived: '#F59E0B',
  returned: '#EF4444',
  cancelled: '#EF4444',
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

// Кастомная цветная иконка-пин через L.divIcon вместо L.Icon.Default — так
// не возникает известная проблема Leaflet+webpack с битыми путями к
// marker-icon.png/marker-shadow.png (default-иконка нигде не используется).
function buildMarkerIcon(color: string, selected: boolean) {
  const width = selected ? 40 : 32
  const height = selected ? 50 : 40
  const ring = selected
    ? '<circle cx="16" cy="16" r="14" fill="none" stroke="white" stroke-width="3"/>'
    : ''

  const svg =
    `<svg width="100%" height="100%" viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg">` +
    `<path d="M16 0C7.163 0 0 7.163 0 16C0 28 16 40 16 40C16 40 32 28 32 16C32 7.163 24.837 0 16 0Z" fill="${color}"/>` +
    ring +
    '<circle cx="16" cy="16" r="7" fill="white"/>' +
    '</svg>'

  return L.divIcon({
    html: svg,
    className: '', // сбрасываем стандартные стили leaflet-div-icon (белый фон, рамка)
    iconSize: [width, height],
    iconAnchor: [width / 2, height],
    popupAnchor: [0, -height],
  })
}

export function MapGL({
  points,
  zones,
  center = [43.238949, 76.889709],
  zoom = 12,
  height = '500px',
  statusColors,
  selectedId,
  onPointClick,
}: MapGLProps) {
  const colors = statusColors ?? DEFAULT_STATUS_COLORS
  const validPoints = useMemo(() => points.filter(isValidAlmatyPoint), [points])

  return (
    <div className="relative rounded-2xl overflow-hidden" style={{ height }}>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ width: '100%', height: '100%' }}
        scrollWheelZoom
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap contributors'
        />

        {zones?.map((zone) => {
          const positions = zone.coordinates.coordinates[0].map(
            ([lng, lat]) => [lat, lng] as [number, number]
          )
          return (
            <Polygon
              key={zone.id}
              positions={positions}
              pathOptions={{ color: zone.color, fillColor: zone.color, fillOpacity: 0.15, weight: 2 }}
            >
              <Popup>{zone.name}</Popup>
            </Polygon>
          )
        })}

        {validPoints.map((point) => {
          const isSelected = point.id === selectedId
          const icon = buildMarkerIcon(colors[point.status] || '#EF4444', isSelected)

          return (
            <Marker
              key={point.id}
              position={[point.lat, point.lng]}
              icon={icon}
              eventHandlers={{
                click: () => onPointClick?.(point),
              }}
            >
              <Popup>
                <div className="text-sm space-y-1">
                  <p className="font-mono font-bold">{point.order_number}</p>
                  <p>{point.client_address}</p>
                  <p>{point.client_phone}</p>
                  <p className="font-bold">{(point.price || 0).toLocaleString('ru-RU')} ₸</p>
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>
    </div>
  )
}

export default MapGL
