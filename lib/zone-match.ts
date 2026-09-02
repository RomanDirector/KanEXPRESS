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

// Supabase/PostgREST молча режет любой select() без .range() на этом лимите —
// без явной пагинации часть backlog (сверх лимита) была бы навсегда невидима
// для бэкфилла zone_id. Пагинируем, пока страница не окажется короче лимита.
const FETCH_PAGE_SIZE = 1000

// Сколько UPDATE-запросов на zone_id гонять параллельно. Чистый batch upsert
// одним запросом здесь не работает: PostgREST/Postgres при ON CONFLICT DO
// UPDATE всё равно проверяет NOT NULL на колонках, не переданных в payload
// (order_number и т.п.) — проверено на реальных данных (ошибка 23502), ещё
// до того как решает, что сработает ветка UPDATE, а не INSERT. Поэтому
// оставляем по одному UPDATE на заказ, но с ограниченным параллелизмом —
// как fetchKaspiOrderEntries в lib/kaspi-sync.ts.
const UPDATE_CONCURRENCY = 10

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++
      results[index] = await fn(items[index])
    }
  })
  await Promise.all(workers)
  return results
}

interface OrderZoneCandidate {
  id: string
  lat: number
  lng: number
}

async function fetchZoneCandidates(
  client: MinimalSupabaseClient,
  sellerId: string,
  { orderIds, statuses }: { orderIds?: string[]; statuses?: string[] },
): Promise<OrderZoneCandidate[]> {
  if (orderIds && orderIds.length === 0) return []

  const all: OrderZoneCandidate[] = []
  let from = 0
  for (;;) {
    let query = client
      .from('orders')
      .select('id, lat, lng')
      .eq('seller_id', sellerId)
      .is('zone_id', null)
      .not('lat', 'is', null)
      .not('lng', 'is', null)

    if (orderIds) query = query.in('id', orderIds)
    if (statuses && statuses.length > 0) query = query.in('status', statuses)

    const { data, error } = await query.range(from, from + FETCH_PAGE_SIZE - 1)
    if (error || !data) break
    all.push(...(data as OrderZoneCandidate[]))
    if (data.length < FETCH_PAGE_SIZE) break
    from += FETCH_PAGE_SIZE
  }
  return all
}

// Только заполняет orders.zone_id по точке (lat/lng) внутри полигона зоны
// продавца — без назначения курьера. Используется из синка Kaspi
// (lib/kaspi-sync.ts), сразу после upsert новых заказов.
//
// orderIds — если передан, бэкфилл ограничивается ТОЛЬКО этими заказами (так
// синк не пересканирует весь исторический backlog без zone_id на каждый
// клик — раньше это добавляло десятки секунд к каждому синку). Без orderIds
// (например, для ручного админского бэкфилла) обрабатывается весь backlog
// продавца, постранично, без скрытого обрезания на 1000 строк.
//
// Каждый матч — точечный UPDATE только по zone_id (с тем же .is('zone_id',
// null) в условии, что и в исходном отборе — если какой-то из этих заказов
// между SELECT и UPDATE успел получить zone_id из другого места, наш UPDATE
// его не перезапишет и не задвоит). Запросы идут с ограниченным
// параллелизмом, а не по одному последовательно — см. UPDATE_CONCURRENCY.
export async function assignZoneIdsForSeller(
  client: MinimalSupabaseClient,
  sellerId: string,
  opts?: { orderIds?: string[]; statuses?: string[] },
): Promise<{ assigned: number; unassigned: number }> {
  const { data: zones, error: zonesError } = await client
    .from('zones')
    .select('id, coordinates')
    .eq('seller_id', sellerId)

  if (zonesError || !zones || zones.length === 0) return { assigned: 0, unassigned: 0 }

  const orders = await fetchZoneCandidates(client, sellerId, opts ?? {})
  if (orders.length === 0) return { assigned: 0, unassigned: 0 }

  const matches: { id: string; zone_id: string }[] = []
  let unassigned = 0

  for (const order of orders) {
    const zone = pointInZone(order.lat, order.lng, zones as ZoneShape[])
    if (!zone) {
      unassigned++
      continue
    }
    matches.push({ id: order.id, zone_id: zone.id })
  }

  const updateResults = await mapWithConcurrency(matches, UPDATE_CONCURRENCY, async (match) => {
    const { error: updError } = await client
      .from('orders')
      .update({ zone_id: match.zone_id })
      .eq('id', match.id)
      .eq('seller_id', sellerId)
      .is('zone_id', null)
    if (updError) console.error('Ошибка обновления zone_id', match.id, updError)
    return !updError
  })

  const assigned = updateResults.filter(Boolean).length
  unassigned += updateResults.length - assigned

  return { assigned, unassigned }
}
