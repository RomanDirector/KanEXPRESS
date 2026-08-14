import * as turf from '@turf/turf'

// Общая геометрия point-in-polygon и "тихое" присвоение zone_id (без
// круговой раздачи курьерам) — используется и клиентским lib/zones.ts,
// и серверным lib/kaspi-sync.ts. Последний бандлится Netlify Function
// отдельным esbuild-пайплайном без резолва tsconfig-алиаса '@/...',
// поэтому здесь только относительные импорты и реальные npm-пакеты.

export interface ZoneShape {
  id: string
  coordinates: GeoJSON.Polygon
}

export function pointInZone<T extends ZoneShape>(lat: number, lng: number, zones: T[]): T | null {
  const point = turf.point([lng, lat])
  for (const zone of zones) {
    try {
      const polygon = turf.polygon(zone.coordinates.coordinates)
      if (turf.booleanPointInPolygon(point, polygon)) return zone
    } catch (e) {
      console.error('Ошибка проверки зоны', zone.id, e)
    }
  }
  return null
}

// Минимальный интерфейс, которому удовлетворяют и браузерный supabase-клиент
// (lib/supabase.ts), и сервисный (lib/supabase-admin.ts) — функции ниже не
// зависят от того, какой именно клиент передан.
interface MinimalSupabaseClient {
  from: (table: string) => any
}

// Только заполняет orders.zone_id по точке (lat/lng) внутри полигона зоны
// продавца — без назначения курьера. Используется как из ручного бэкфилла
// (lib/zones.ts::assignZonesToOrders — там ещё и курьер по round-robin), так
// и из синка Kaspi (lib/kaspi-sync.ts), сразу после upsert новых заказов.
export async function assignZoneIdsForSeller(
  client: MinimalSupabaseClient,
  sellerId: string,
  statuses?: string[],
): Promise<{ assigned: number; unassigned: number }> {
  const { data: zones, error: zonesError } = await client
    .from('zones')
    .select('id, coordinates')
    .eq('seller_id', sellerId)

  if (zonesError || !zones || zones.length === 0) return { assigned: 0, unassigned: 0 }

  let query = client
    .from('orders')
    .select('id, lat, lng')
    .eq('seller_id', sellerId)
    .is('zone_id', null)
    .not('lat', 'is', null)
    .not('lng', 'is', null)

  if (statuses && statuses.length > 0) query = query.in('status', statuses)

  const { data: orders, error } = await query
  if (error || !orders) return { assigned: 0, unassigned: 0 }

  let assigned = 0
  let unassigned = 0

  for (const order of orders) {
    const zone = pointInZone(order.lat, order.lng, zones as ZoneShape[])
    if (!zone) {
      unassigned++
      continue
    }
    const { error: updError } = await client
      .from('orders')
      .update({ zone_id: zone.id })
      .eq('id', order.id)
      .eq('seller_id', sellerId)
    if (updError) {
      console.error('Ошибка обновления zone_id', order.id, updError)
    } else {
      assigned++
    }
  }

  return { assigned, unassigned }
}
