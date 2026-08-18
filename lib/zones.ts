import { supabase } from '@/lib/supabase'
import { pointInZone } from '@/lib/zone-match'

export interface Zone {
  id: string
  name: string
  color: string
  coordinates: GeoJSON.Polygon
}

// Геометрия point-in-polygon вынесена в lib/zone-match.ts, чтобы её же мог
// использовать серверный lib/kaspi-sync.ts (без дублирования кода).
export { pointInZone }

// sellerId передаётся явно (раньше подставлялся из auth.getUser()) — вызывающая
// сторона теперь всегда админка, которая управляет зонами/ящиками за любого продавца.
export async function loadZones(sellerId: string): Promise<Zone[]> {
  if (!sellerId) return []
  const { data, error } = await supabase
    .from('zones')
    .select('id, name, color, coordinates')
    .eq('seller_id', sellerId)
    .order('created_at')
  if (error) { console.error('Ошибка загрузки зон:', error); return [] }
  return (data || []) as Zone[]
}

export async function assignZonesToOrders(sellerId: string): Promise<{ assigned: number; unassigned: number }> {
  if (!sellerId) return { assigned: 0, unassigned: 0 }

  const zones = await loadZones(sellerId)
  if (zones.length === 0) return { assigned: 0, unassigned: 0 }

  const { data: courierZoneRows, error: czError } = await supabase
    .from('courier_zones')
    .select('zone_id, couriers(full_name), zones!inner(seller_id)')
    .eq('zones.seller_id', sellerId)
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
    .eq('seller_id', sellerId)
    .is('courier_name', null).in('status', ['pending', 'in_transit'])
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
        .eq('seller_id', sellerId)
      if (updError) console.error('Ошибка обновления заказа', order.id, updError)
      else assigned++
    } else {
      const { error: updError } = await supabase.from('orders')
        .update({ zone_id: zone.id })
        .eq('id', order.id)
        .eq('seller_id', sellerId)
      if (updError) console.error('Ошибка обновления заказа (только zone_id)', order.id, updError)
      unassigned++
    }
  }
  return { assigned, unassigned }
}