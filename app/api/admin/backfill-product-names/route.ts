import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import {
  fetchKaspiOrderEntries,
  formatProductName,
  sumProductQuantity,
  isValidKaspiToken,
} from '@/lib/kaspi'

// Разовый бэкфилл product_name для заказов, у которых название не заполнено.
// Обычный синк (lib/kaspi-sync.ts) берёт окно 2 дня и старые заказы не покрывает.
// Роут обрабатывает ПАЧКУ за вызов (limit, по умолчанию 200), чтобы не упереться
// в таймаут Netlify Functions (~10-26 с). Клиент вызывает его повторно, пока
// remaining > 0. Токены Kaspi читаются только здесь, на сервере, через
// service-role клиент и нигде не логируются.

export const dynamic = 'force-dynamic'
// Верхняя граница выполнения на Netlify Functions — обрабатываем пачку в этот бюджет.
export const maxDuration = 26

const DEFAULT_LIMIT = 200
const MAX_LIMIT = 500
// Название товара тянется отдельным запросом на КАЖДЫЙ заказ, поэтому качаем
// пачками с тем же ограничением параллелизма, что и обычный синк.
const ENTRIES_CONCURRENCY = 6

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

function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

// Серверная проверка доступа: auth.uid() должен быть в таблице admins
// (см. app/api/kaspi/debug/route.ts). Запасной путь по ADMIN_EMAILS — как в
// app/api/admin/geocode-keys/route.ts, на время миграции на таблицу admins.
async function requireAdmin(request: NextRequest) {
  const authHeader = request.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) return null

  const supabase = createAdminClient()
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return null

  const { data: admin } = await supabase
    .from('admins')
    .select('id')
    .eq('id', data.user.id)
    .maybeSingle()

  if (admin) return data.user

  if (data.user.email && getAdminEmails().includes(data.user.email.toLowerCase())) {
    return data.user
  }

  return null
}

interface SellerCreds {
  id: string
  kaspi_token: string | null
}

interface NullNameOrder {
  id: string
  seller_id: string
  kaspi_order_id: string
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) {
    return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 })
  }

  let limit = DEFAULT_LIMIT
  try {
    const body = (await request.json()) as { limit?: number }
    if (typeof body?.limit === 'number' && Number.isFinite(body.limit)) {
      limit = Math.max(1, Math.min(MAX_LIMIT, Math.floor(body.limit)))
    }
  } catch {
    // Пустое/некорректное тело — работаем с limit по умолчанию.
  }

  const supabase = createAdminClient()

  // Продавцы с валидным токеном. Валидность (isValidKaspiToken отсекает и null,
  // и заглушки вроде 'test'/'demo') не выражается одним SQL-фильтром, поэтому
  // фильтруем в JS — продавцов немного. Заказы и счётчик remaining скоупим по
  // этим продавцам, иначе заказы без токена держали бы remaining > 0 вечно.
  const { data: sellersRaw, error: sellersError } = await supabase
    .from('sellers')
    .select('id, kaspi_token')

  if (sellersError) {
    return NextResponse.json({ error: sellersError.message }, { status: 500 })
  }

  const tokenBySeller = new Map<string, string>()
  for (const s of (sellersRaw ?? []) as SellerCreds[]) {
    if (isValidKaspiToken(s.kaspi_token)) tokenBySeller.set(s.id, s.kaspi_token)
  }
  const validSellerIds = Array.from(tokenBySeller.keys())

  if (validSellerIds.length === 0) {
    return NextResponse.json({ processed: 0, updated: 0, failed: 0, remaining: 0 })
  }

  // Считаем сколько ещё осталось незаполненных (у продавцов с валидным токеном) —
  // это remaining, по которому клиент решает, звать ли роут снова.
  async function countRemaining(): Promise<number> {
    const { count } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .is('product_name', null)
      .not('kaspi_order_id', 'is', null)
      .in('seller_id', validSellerIds)
    return count ?? 0
  }

  // Пачка заказов без названия. kaspi_order_id обязателен — по нему тянем позиции.
  const { data: batch, error: batchError } = await supabase
    .from('orders')
    .select('id, seller_id, kaspi_order_id')
    .is('product_name', null)
    .not('kaspi_order_id', 'is', null)
    .in('seller_id', validSellerIds)
    .limit(limit)

  if (batchError) {
    return NextResponse.json({ error: batchError.message }, { status: 500 })
  }

  const orders = (batch ?? []) as NullNameOrder[]

  if (orders.length === 0) {
    return NextResponse.json({ processed: 0, updated: 0, failed: 0, remaining: await countRemaining() })
  }

  let updated = 0
  let failed = 0

  // Ошибка одного заказа (сбой запроса позиций/товара или записи) НЕ роняет
  // пачку — только логируется и увеличивает failed. Такой заказ остаётся с
  // product_name IS NULL и будет переобработан при следующем вызове.
  await mapWithConcurrency(orders, ENTRIES_CONCURRENCY, async (order) => {
    const token = tokenBySeller.get(order.seller_id)
    if (!token) return
    try {
      const entries = await fetchKaspiOrderEntries({ token, orderId: order.kaspi_order_id })
      const productName = formatProductName(entries)
      // Kaspi не вернул названия для заказа — это не сбой, но записывать нечего.
      // Оставляем NULL (заказ попадёт в remaining); клиент останавливается, когда
      // пачки перестают давать прогресс.
      if (!productName) return

      const { error: updateError } = await supabase
        .from('orders')
        .update({ product_name: productName, product_quantity: sumProductQuantity(entries) })
        .eq('id', order.id)

      if (updateError) throw new Error(updateError.message)
      updated++
    } catch (err) {
      failed++
      console.error(`[backfill-product-names] заказ ${order.id}: не удалось заполнить название`, err)
    }
  })

  return NextResponse.json({
    processed: orders.length,
    updated,
    failed,
    remaining: await countRemaining(),
  })
}
