const KASPI_API_BASE = 'https://kaspi.kz/shop/api/v2'

// Ограничитель пагинации — предохранитель от бесконечного цикла, если Kaspi
// вернёт некорректный meta.pageCount.
const MAX_PAGES = 50
const PAGE_SIZE = 100

// Значения, которые продавец мог оставить в форме регистрации вместо реального
// токена (пустое поле, тестовые данные) — с такими к Kaspi API не ходим.
const STUB_TOKENS = new Set(['', 'test', 'demo', 'stub', 'xxx', '-'])

export function isValidKaspiToken(token: string | null | undefined): token is string {
  if (!token) return false
  return !STUB_TOKENS.has(token.trim().toLowerCase())
}

export interface KaspiOrder {
  id: string
  code: string
  state: string
  creationDate: number
  customer?: { cellPhone?: string }
  deliveryAddress?: { formattedAddress?: string; latitude?: number; longitude?: number }
}

interface KaspiOrdersResponse {
  data: Array<{ id: string; attributes: Omit<KaspiOrder, 'id'> }>
  meta?: { pageCount?: number }
}

// Поля в attributes соответствуют публичному Kaspi Merchant API v2 (JSON:API).
// Перед использованием в проде сверь названия полей с реальным ответом для
// конкретного магазина — Kaspi иногда меняет форму ответа между версиями.
export async function fetchKaspiOrders({
  token,
  shopId,
}: {
  token: string
  shopId: string
}): Promise<KaspiOrder[]> {
  const orders: KaspiOrder[] = []

  for (let pageNumber = 0; pageNumber < MAX_PAGES; pageNumber++) {
    const url = new URL(`${KASPI_API_BASE}/orders`)
    url.searchParams.set('page[number]', String(pageNumber))
    url.searchParams.set('page[size]', String(PAGE_SIZE))
    if (shopId) url.searchParams.set('filter[orders][shopId]', shopId)

    const res = await fetch(url.toString(), {
      headers: {
        'X-Auth-Token': token,
        'Content-Type': 'application/vnd.api+json',
      },
      cache: 'no-store',
    })

    if (!res.ok) {
      throw new Error(`Kaspi API ответил ${res.status} (магазин ${shopId || '—'})`)
    }

    const json = (await res.json()) as KaspiOrdersResponse
    const pageOrders = json.data.map((item) => ({ id: item.id, ...item.attributes }))
    orders.push(...pageOrders)

    const pageCount = json.meta?.pageCount ?? 1
    if (pageOrders.length === 0 || pageNumber + 1 >= pageCount) break
  }

  return orders
}

// Один "сырой" запрос без маппинга и пагинации — только для ручной сверки
// реальных названий полей ответа. Используется временным debug-роутом
// app/api/kaspi/debug/route.ts.
export async function fetchKaspiOrdersRaw({
  token,
  shopId,
}: {
  token: string
  shopId: string
}): Promise<unknown> {
  const url = new URL(`${KASPI_API_BASE}/orders`)
  url.searchParams.set('page[number]', '0')
  url.searchParams.set('page[size]', '5')
  if (shopId) url.searchParams.set('filter[orders][shopId]', shopId)

  const res = await fetch(url.toString(), {
    headers: {
      'X-Auth-Token': token,
      'Content-Type': 'application/vnd.api+json',
    },
    cache: 'no-store',
  })

  const body = await res.json().catch(() => null)

  if (!res.ok) {
    throw new Error(`Kaspi API ответил ${res.status}: ${JSON.stringify(body)}`)
  }

  return body
}

// Статусы заказа в Kaspi заметно детальнее наших — сводим к трём стадиям,
// которые понимает остальной код (курьерский дашборд, статистика и т.д.).
// Незнакомое/новое состояние Kaspi безопаснее оставлять как 'pending', чем
// угадывать — иначе такой заказ может выпасть из отображения.
const STATUS_MAP: Record<string, string> = {
  ACCEPTED_BY_MERCHANT: 'pending',
  ASSEMBLE: 'pending',
  KASPI_DELIVERY: 'in_transit',
  DELIVERY: 'in_transit',
  COMPLETED: 'delivered',
}

export function mapKaspiStatus(state: string): string {
  return STATUS_MAP[state] ?? 'pending'
}

export function mapKaspiOrderToRow(order: KaspiOrder, sellerId: string) {
  return {
    seller_id: sellerId,
    order_number: order.code,
    client_phone: order.customer?.cellPhone ?? '',
    client_address: order.deliveryAddress?.formattedAddress ?? '',
    status: mapKaspiStatus(order.state),
    created_at: new Date(order.creationDate).toISOString(),
    lat: order.deliveryAddress?.latitude ?? null,
    lng: order.deliveryAddress?.longitude ?? null,
  }
}
