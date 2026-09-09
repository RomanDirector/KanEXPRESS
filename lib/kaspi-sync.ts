import { createAdminClient } from './supabase-admin'
import {
  fetchKaspiOrders,
  fetchKaspiOrderEntries,
  formatProductName,
  sumProductQuantity,
  mapKaspiOrderToRow,
  mapKaspiOrderState,
  isValidKaspiToken,
  type KaspiOrder,
} from './kaspi'
import { assignZoneIdsForSeller } from './zone-match'

// Название товара тянется отдельным запросом на КАЖДЫЙ заказ (см. fetchKaspiOrderEntries),
// поэтому качаем позиции пачками с ограничением параллелизма, чтобы не упереться
// в таймауты/лимиты Kaspi при большом окне заказов.
const ENTRIES_CONCURRENCY = 6
const TERMINAL_UPDATE_CONCURRENCY = 10

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

// Название товара и суммарное количество для одного заказа. Любая ошибка
// запроса позиций/товара НЕ роняет синк — возвращаем null и логируем (заказ
// сохранится без названия/количества).
async function resolveProductInfo(
  token: string,
  orderId: string
): Promise<{ name: string | null; quantity: number | null }> {
  try {
    const entries = await fetchKaspiOrderEntries({ token, orderId })
    return { name: formatProductName(entries), quantity: sumProductQuantity(entries) }
  } catch (err) {
    console.error(`[kaspi-sync] заказ ${orderId}: не удалось получить позиции товара`, err)
    return { name: null, quantity: null }
  }
}

// Терминальные courier_stage ('cancelled'/'returned') от Kaspi применяются
// ОТДЕЛЬНЫМ guarded UPDATE после общего апсерта, а не прямо в mapKaspiOrderToRow —
// см. комментарий там же. Гвард `courier_stage='not_started'` — если курьер в
// приложении уже сам продвинул заказ (dropped/departed/arrived/delivered/...),
// сигнал от Kaspi не должен затирать его реальный прогресс.
async function applyKaspiTerminalStates(
  supabase: ReturnType<typeof createAdminClient>,
  kaspiOrders: KaspiOrder[],
  upsertedRows: { id: string; order_number: string }[]
): Promise<void> {
  const byOrderNumber = new Map(kaspiOrders.map((o) => [o.code, o]))
  const targets = upsertedRows
    .map((row) => {
      const kaspiOrder = byOrderNumber.get(row.order_number)
      if (!kaspiOrder) return null
      const mapped = mapKaspiOrderState(kaspiOrder)
      if (!mapped.courierStage) return null
      return { id: row.id, courierStage: mapped.courierStage, cancelReason: mapped.cancelReason }
    })
    .filter((x): x is { id: string; courierStage: 'cancelled' | 'returned'; cancelReason: string | null } => x !== null)

  if (targets.length === 0) return

  await mapWithConcurrency(targets, TERMINAL_UPDATE_CONCURRENCY, async (target) => {
    const update: Record<string, unknown> = { courier_stage: target.courierStage }
    // cancel_reason/cancelled_by/cancelled_at — только для реальной отмены,
    // как в собственном флоу отмены курьера (courier-dashboard). Для
    // 'returned' наш же курьерский флоу их не проставляет — не выдумываем лишнее.
    if (target.courierStage === 'cancelled') {
      update.cancel_reason = target.cancelReason
      update.cancelled_by = 'kaspi'
      update.cancelled_at = new Date().toISOString()
    }
    const { error } = await supabase
      .from('orders')
      .update(update)
      .eq('id', target.id)
      .eq('courier_stage', 'not_started')
    if (error) console.error('[kaspi-sync] ошибка применения terminal-статуса Kaspi', target.id, error)
  })
}

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
      const token = seller.kaspi_token
      const kaspiOrders = await fetchKaspiOrders({
        token,
        shopId: seller.kaspi_shop_id ?? '',
      })

      // Названия товаров и количество качаются отдельными запросами к Kaspi
      // (позиции заказа), параллельно с ограничением — см. resolveProductInfo / mapWithConcurrency.
      const productInfos = await mapWithConcurrency(
        kaspiOrders,
        ENTRIES_CONCURRENCY,
        (order) => resolveProductInfo(token, order.id),
      )

      const rows = kaspiOrders.map((order, i) =>
        mapKaspiOrderToRow(order, seller.id, productInfos[i].name, productInfos[i].quantity)
      )

      if (rows.length > 0) {
        const { data: upsertedRows, error: upsertError } = await supabase
          .from('orders')
          .upsert(rows, { onConflict: 'seller_id,order_number' })
          .select('id, order_number')

        if (upsertError) throw new Error(upsertError.message)

        // Автоприсвоение zone_id — только заказам ИЗ ЭТОГО синка (orderIds),
        // а не всему историческому backlog без zone_id у продавца: раньше
        // assignZoneIdsForSeller пересканировала весь backlog на каждый
        // клик "Обновить заказы из Kaspi" — на продавце с ~1700 неразобранными
        // заказами это добавляло ~59с к каждому синку. Бэкфилл старого
        // backlog — отдельная ручная операция (lib/zones.ts), не часть синка.
        // Ошибка здесь не должна ронять синк заказов — только логируется.
        try {
          const orderIds = (upsertedRows ?? []).map((r) => r.id)
          await assignZoneIdsForSeller(supabase, seller.id, { orderIds })
        } catch (zoneErr) {
          console.error(`[kaspi-sync] продавец ${seller.id}: ошибка авто-присвоения зон`, zoneErr)
        }

        // Отменённые/возвращённые на Kaspi заказы из ЭТОГО синка — см.
        // applyKaspiTerminalStates. Тоже не должно ронять синк заказов.
        try {
          await applyKaspiTerminalStates(supabase, kaspiOrders, upsertedRows ?? [])
        } catch (terminalErr) {
          console.error(`[kaspi-sync] продавец ${seller.id}: ошибка применения terminal-статусов Kaspi`, terminalErr)
        }
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
