import * as turf from '@turf/turf'
import { supabase } from '@/lib/supabase'

export interface Zone {
  id: string
  name: string
  color: string
  coordinates: GeoJSON.Polygon
}

export function pointInZone(lat: number, lng: number, zones: Zone[]): Zone | null {
  const point = turf.point([lng, lat])
  for (const zone of zones) {
    try {
      const polygon = turf.polygon(zone.coordinates.coordinates)
      if (turf.booleanPointInPolygon(point, polygon)) return zone
    } catch (e) {
      console.error('Ошибка проверки зоны', zone.name, e)
    }
  }
  return null
}

export async function loadZones(): Promise<Zone[]> {
  const { data, error } = await supabase.from('zones').select('id, name, color, coordinates').order('created_at')
  if (error) { console.error('Ошибка загрузки зон:', error); return [] }
  return (data || []) as Zone[]
}

export async function assignZonesToOrders(): Promise<number> {
  const zones = await loadZones()
  if (zones.length === 0) return 0

  const { data: orders, error } = await supabase
    .from('orders').select('id, lat, lng')
    .is('zone_id', null).not('lat', 'is', null).not('lng', 'is', null)

  if (error || !orders) { console.error('Ошибка загрузки заказов:', error); return 0 }

  let updated = 0
  for (const order of orders) {
    const zone = pointInZone(order.lat, order.lng, zones)
    if (zone) {
      const { error: updError } = await supabase.from('orders').update({ zone_id: zone.id }).eq('id', order.id)
      if (!updError) updated++
    }
  }
  return updated
}