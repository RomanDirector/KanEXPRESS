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
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []
  const { data, error } = await supabase
    .from('zones')
    .select('id, name, color, coordinates')
    .eq('seller_id', user.id)
    .order('created_at')
  if (error) { console.error('Ошибка загрузки зон:', error); return [] }
  return (data || []) as Zone[]
}

export async function assignZonesToOrders(): Promise<{ assigned: number; unassigned: number }> {
  const zones = await loadZones()
  if (zones.length === 0) return { assigned: 0, unassigned: 0 }

  const { data: courierZoneRows, error: czError } = await supabase
    .from('courier_zones')
    .select('zone_id, couriers(full_name)')
  if (czError) { console.error('Ошибка загрузки courier_zones:', czError); return { assigned: 0, unassigned: 0 } }

  const zoneToCouriers: Record<string, string[]> = {}
  for (const row of courierZoneRows || []) {
    const name = (row as any).couriers?.full_name
    if (!name) continue
    if (!zoneToCouriers[row.zone_id]) zoneToCouriers[row.zone_id] = []
    zoneToCouriers[row.zone_id].push(name)
  }

  const { data: orders, error } = await supabase
    .from('orders').select('id, lat, lng')
    .is('courier_name', null).eq('status', 'pending')
    .not('lat', 'is', null).not('lng', 'is', null)
  if (error || !orders) { console.error('Ошибка загрузки заказов:', error); return { assigned: 0, unassigned: 0 } }

  let assigned = 0
  let unassigned = 0
  const roundRobinIndex: Record<string, number> = {}

  for (const order of orders) {
    const zone = pointInZone(order.lat, order.lng, zones)
    if (!zone) { unassigned++; continue }

    const couriers = zoneToCouriers[zone.id]
    if (couriers && couriers.length > 0) {
      const idx = (roundRobinIndex[zone.id] || 0) % couriers.length
      roundRobinIndex[zone.id] = idx + 1
      const { error: updError } = await supabase.from('orders')
        .update({ courier_name: couriers[idx], courier_stage: 'not_started', zone_id: zone.id })
        .eq('id', order.id)
      if (updError) console.error('Ошибка обновления заказа', order.id, updError)
      else assigned++
    } else {
      const { error: updError } = await supabase.from('orders')
        .update({ zone_id: zone.id })
        .eq('id', order.id)
      if (updError) console.error('Ошибка обновления заказа (только zone_id)', order.id, updError)
      unassigned++
    }
  }
  return { assigned, unassigned }
}