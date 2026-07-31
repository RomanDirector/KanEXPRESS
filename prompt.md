1. "Работаю с магазинами" в профиле курьера:

На странице app/(courier)/profile/page.tsx, в блоке "Работаю с магазинами":

1. Подгрузи организации, с которыми связан текущий курьер через зоны:
   select distinct sellers.organization_name, sellers.id
   from courier_zones
   join zones on zones.id = courier_zones.zone_id
   join sellers on sellers.id = zones.seller_id
   where courier_zones.courier_id = <id текущего курьера>

2. Если список пуст — оставь текущий текст "Пока нет заказов, привязанных к магазину"
3. Если есть — выведи organization_name каждой строкой/бейджем вместо заглушки

2. Кластеризация маркеров:

Установи: npm install leaflet.markercluster
Установи типы: npm install --save-dev @types/leaflet.markercluster

В components/MapGL.tsx добавь импорты (рядом с существующими leaflet-импортами):
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import 'leaflet.markercluster'
import { useMap } from 'react-leaflet'
import { useEffect, useRef } from 'react'

Создай компонент ClusterLayer внутри файла (переиспользуй существующую buildMarkerIcon, не переписывай):

function ClusterLayer({ points, colors, selectedId, onPointClick }: {
  points: MapPoint[]
  colors: Record<string, string>
  selectedId?: string | null
  onPointClick?: (point: MapPoint) => void
}) {
  const map = useMap()
  const clusterRef = useRef<any>(null)

  useEffect(() => {
    const clusterGroup = (L as any).markerClusterGroup({
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
    })
    clusterRef.current = clusterGroup
    map.addLayer(clusterGroup)
    return () => { map.removeLayer(clusterGroup); clusterRef.current = null }
  }, [map])

  useEffect(() => {
    const clusterGroup = clusterRef.current
    if (!clusterGroup) return
    clusterGroup.clearLayers()
    points.forEach((point) => {
      const isSelected = point.id === selectedId
      const icon = buildMarkerIcon(colors[point.status] || '#EF4444', isSelected)
      const marker = L.marker([point.lat, point.lng], { icon })
      marker.bindPopup(
        `<div style="font-size:13px"><b>${point.order_number}</b><br/>${point.client_address}<br/>${point.client_phone}<br/><b>${(point.price || 0).toLocaleString('ru-RU')} ₸</b></div>`
      )
      if (onPointClick) marker.on('click', () => onPointClick(point))
      clusterGroup.addLayer(marker)
    })
  }, [points, colors, selectedId, onPointClick])

  return null
}

Замени текущий {validPoints.map((point) => <Marker ...>...)} блок внутри MapContainer на:
<ClusterLayer points={validPoints} colors={colors} selectedId={selectedId} onPointClick={onPointClick} />

Зоны (Polygon) НЕ кластеризуй — оставь как есть, кластеризация только для точек заказов.