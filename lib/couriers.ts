import { supabase } from '@/lib/supabase'

// Курьеры — общая для всей системы таблица (см. комментарий в staff/page.tsx), привязка
// к продавцу идёт через courier_zones -> zones.seller_id (courier_sellers в проекте не
// существует — единственная реальная связь курьер/продавец уже реализована так в staff.tsx).
export async function getSellerCourierIds(sellerId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('courier_zones')
    .select('courier_id, zones!inner(seller_id)')
    .eq('zones.seller_id', sellerId)

  if (error) {
    console.error('getSellerCourierIds: failed to load courier_zones', error)
    return []
  }

  const ids = new Set<string>()
  for (const row of (data || []) as { courier_id: string | null }[]) {
    if (row.courier_id) ids.add(row.courier_id)
  }
  return Array.from(ids)
}
