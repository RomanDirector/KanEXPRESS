Нашёл настоящую причину — и она серьёзнее, чем просто баг с координатами. Функция assignZonesToOrders вообще не то делает: она ищет заказы с zone_id is null и в случае совпадения зоны пишет zone_id в заказ. А наша карта курьера фильтрует заказы по courier_name! То есть эта функция никогда не могла бы прокинуть заказ курьеру — она просто не с той колонкой работает, и courier_zones (кто из курьеров привязан к зоне) она вообще не читает.

Скорее всего, orders.zone_id даже не существует как колонка (мы её никогда не создавали) — отсюда и молчаливые 0: update падает с ошибкой, updError не логируется, updated остаётся 0.

Переписываю assignZonesToOrders под реальную схему — с courier_zones и записью courier_name:

typescript
export async function assignZonesToOrders(): Promise<{ assigned: number; unassigned: number }> {
  const zones = await loadZones()
  if (zones.length === 0) return { assigned: 0, unassigned: 0 }

  const { data: courierZoneRows, error: czError } = await supabase
    .from('courier_zones')
    .select('zone_id, couriers(full_name)')

  if (czError) {
    console.error('Ошибка загрузки courier_zones:', czError)
    return { assigned: 0, unassigned: 0 }
  }

  const zoneToCouriers: Record<string, string[]> = {}
  for (const row of courierZoneRows || []) {
    const name = (row as any).couriers?.full_name
    if (!name) continue
    if (!zoneToCouriers[row.zone_id]) zoneToCouriers[row.zone_id] = []
    zoneToCouriers[row.zone_id].push(name)
  }

  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, lat, lng')
    .is('courier_name', null)
    .eq('status', 'pending')
    .not('lat', 'is', null)
    .not('lng', 'is', null)

  if (error || !orders) {
    console.error('Ошибка загрузки заказов:', error)
    return { assigned: 0, unassigned: 0 }
  }

  let assigned = 0
  let unassigned = 0
  const roundRobinIndex: Record<string, number> = {}

  for (const order of orders) {
    const zone = pointInZone(order.lat, order.lng, zones)
    const couriers = zone ? zoneToCouriers[zone.id] : undefined

    if (zone && couriers && couriers.length > 0) {
      const idx = (roundRobinIndex[zone.id] || 0) % couriers.length
      roundRobinIndex[zone.id] = idx + 1
      const { error: updError } = await supabase
        .from('orders')
        .update({ courier_name: couriers[idx] })
        .eq('id', order.id)
      if (updError) console.error('Ошибка обновления заказа', order.id, updError)
      else assigned++
    } else {
      unassigned++
    }
  }

  return { assigned, unassigned }
}

И в app/(seller)/zones/page.tsx поправь handleAssign, чтобы показывал оба числа:

typescript
async function handleAssign() {
  setAssigning(true)
  setResult(null)
  const { assigned, unassigned } = await assignZonesToOrders()
  setAssigning(false)
  setResult(`Распределено: ${assigned}, не распределено: ${unassigned}`)
}

Дай агенту заменить assignZonesToOrders в lib/zones.ts целиком на это, поправить handleAssign, и заодно спроси его — есть ли в orders реально колонка zone_id (пусть проверит через information_schema), чтобы понимать, чинить старую логику или она изначально была нерабочей заглушкой.

После замены — жми кнопку ещё раз, скинь результат.