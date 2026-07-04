import { createAdminClient } from './supabase-admin'
import { fetchKaspiOrders, mapKaspiOrderToRow, isValidKaspiToken } from './kaspi'

// Импорты относительные (не через алиас '@/lib/...'), т.к. этот модуль
// используется и Next.js роутами, и Netlify Function — последнюю Netlify
// бандлит своим esbuild-пайплайном отдельно от Next и не резолвит tsconfig paths.

interface SellerCreds {
  id: string
  kaspi_token: string | null
  kaspi_shop_id: string | null
}

export interface SellerSyncResult {
  sellerId: string
  synced: number
  error?: string
}

// Общая логика мультитенантного синка: каждый продавец опрашивается Kaspi
// Merchant API своим kaspi_token/kaspi_shop_id, заказы пишутся с его seller_id.
// sellerId передан — синк одного продавца. Не передан — все продавцы с
// валидным токеном (используется в расписании).
// Невалидный токен (в т.ч. 401/403 от Kaspi) у одного продавца не прерывает
// обработку остальных — ошибка логируется и складывается в results.
export async function syncKaspiOrders(sellerId?: string): Promise<SellerSyncResult[]> {
  const supabase = createAdminClient()

  let sellers: SellerCreds[]

  if (sellerId) {
    const { data, error } = await supabase
      .from('sellers')
      .select('id, kaspi_token, kaspi_shop_id')
      .eq('id', sellerId)
      .maybeSingle()

    if (error || !data) {
      throw new Error('Продавец не найден')
    }
    sellers = [data]
  } else {
    const { data, error } = await supabase
      .from('sellers')
      .select('id, kaspi_token, kaspi_shop_id')

    if (error) throw new Error(error.message)
    sellers = (data ?? []).filter((s) => isValidKaspiToken(s.kaspi_token))
  }

  const results: SellerSyncResult[] = []

  for (const seller of sellers) {
    if (!isValidKaspiToken(seller.kaspi_token)) {
      results.push({ sellerId: seller.id, synced: 0, error: 'kaspi_token не задан' })
      continue
    }

    try {
      const kaspiOrders = await fetchKaspiOrders({
        token: seller.kaspi_token,
        shopId: seller.kaspi_shop_id ?? '',
      })

      const rows = kaspiOrders.map((order) => mapKaspiOrderToRow(order, seller.id))

      if (rows.length > 0) {
        const { error: upsertError } = await supabase
          .from('orders')
          .upsert(rows, { onConflict: 'seller_id,order_number' })

        if (upsertError) throw new Error(upsertError.message)
      }

      results.push({ sellerId: seller.id, synced: rows.length })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Неизвестная ошибка синхронизации'
      console.error(`[kaspi-sync] продавец ${seller.id}: ${message}`)
      results.push({ sellerId: seller.id, synced: 0, error: message })
    }
  }

  return results
}
