import 'server-only'

const KASPI_API_BASE = process.env.KASPI_API_BASE || 'https://kaspi.kz/shop/api/v2'

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
    kaspi_order_id: order.id,
    order_number: order.code,
    client_phone: order.customer?.cellPhone ?? '',
    client_address: order.deliveryAddress?.formattedAddress ?? '',
    status: mapKaspiStatus(order.state),
    created_at: new Date(order.creationDate).toISOString(),
    lat: order.deliveryAddress?.latitude ?? null,
    lng: order.deliveryAddress?.longitude ?? null,
  }
}

// Двухшаговое подтверждение выдачи заказа курьером через Kaspi API: сначала
// запрашиваем отправку кода клиенту (X-Send-Code: true без кода), затем
// подтверждаем введённый курьером код (X-Security-Code).
export async function requestDeliveryCode({ token, kaspiOrderId, orderCode }: {
  token: string; kaspiOrderId: string; orderCode: string
}): Promise<void> {
  const res = await fetch(`${KASPI_API_BASE}/orders`, {
    method: 'POST',
    headers: {
      'X-Auth-Token': token,
      'X-Security-Code': '',
      'X-Send-Code': 'true',
      'Content-Type': 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: { type: 'orders', id: kaspiOrderId, attributes: { code: orderCode, status: 'COMPLETED' } },
    }),
    cache: 'no-store',
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Kaspi API (request code) ответил ${res.status}: ${body}`)
  }
}

export async function confirmDeliveryCode({ token, kaspiOrderId, orderCode, securityCode }: {
  token: string; kaspiOrderId: string; orderCode: string; securityCode: string
}): Promise<{ status: string }> {
  const res = await fetch(`${KASPI_API_BASE}/orders`, {
    method: 'POST',
    headers: {
      'X-Auth-Token': token,
      'X-Security-Code': securityCode,
      'X-Send-Code': 'true',
      'Content-Type': 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: { type: 'orders', id: kaspiOrderId, attributes: { code: orderCode, status: 'COMPLETED' } },
    }),
    cache: 'no-store',
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(`Kaspi API (confirm code) ответил ${res.status}: ${JSON.stringify(body)}`)
  const status = body?.data?.attributes?.status
  if (status !== 'COMPLETED') throw new Error('Kaspi не подтвердил код')
  return { status }
}

// --- Публикация цен через Kaspi Merchant API (KASPI_MERCHANT_TOKEN/KASPI_MERCHANT_ID) ---
//
// В отличие от fetchKaspiOrders выше (мультитенантно, токен каждого продавца из sellers.kaspi_token),
// обновление цены пока рассчитано на один общий мерчант-токен из env. Если/когда демпинг станет
// многотенантным по-настоящему, эту часть нужно будет перевести на per-seller токены так же, как orders.

// ПРОВЕРИТЬ ПО ДОКУМЕНТАЦИИ KASPI: пути ниже — предположение по аналогии с /orders (JSON:API,
// PATCH ресурса товара). Реальные эндпоинты и формат тела запроса для обновления цены нужно
// сверить с документацией Kaspi Merchant API перед использованием в проде.
const KASPI_PRICE_ENDPOINTS = {
  product: (sku: string) => `/products/${encodeURIComponent(sku)}`,
}

function getToken(): string {
  const token = process.env.KASPI_MERCHANT_TOKEN
  if (!token) {
    throw new Error('KASPI_MERCHANT_TOKEN не задан в переменных окружения')
  }
  return token
}

function getMerchantId(): string {
  const id = process.env.KASPI_MERCHANT_ID
  if (!id) {
    throw new Error('KASPI_MERCHANT_ID не задан в переменных окружения')
  }
  return id
}

async function kaspiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken()

  const res = await fetch(`${KASPI_API_BASE}${path}`, {
    ...init,
    headers: {
      // ПРОВЕРИТЬ ПО ДОКУМЕНТАЦИИ KASPI: заголовок авторизации может быть
      // Authorization: Bearer <token> вместо X-Auth-Token — сверить с реальным API.
      'X-Auth-Token': token,
      'Content-Type': 'application/vnd.api+json',
      ...(init.headers as Record<string, string> | undefined),
    },
    cache: 'no-store',
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Kaspi API ответил ${res.status}: ${body}`)
  }

  return res
}

export async function updateProductPrice(sku: string, price: number): Promise<void> {
  const merchantId = getMerchantId()
  // ПРОВЕРИТЬ ПО ДОКУМЕНТАЦИИ KASPI: метод (PATCH) и форма тела запроса — предположение
  // по JSON:API конвенции, сверить с реальным Merchant API перед продом.
  await kaspiFetch(KASPI_PRICE_ENDPOINTS.product(sku), {
    method: 'PATCH',
    body: JSON.stringify({
      data: {
        type: 'products',
        id: sku,
        attributes: { price, merchantId },
      },
    }),
  })
}

export async function getProductPrice(sku: string): Promise<number> {
  const res = await kaspiFetch(KASPI_PRICE_ENDPOINTS.product(sku), { method: 'GET' })
  const json = (await res.json()) as { data?: { attributes?: { price?: number } } }
  // ПРОВЕРИТЬ ПО ДОКУМЕНТАЦИИ KASPI: путь до цены в ответе (data.attributes.price) — предположение.
  const price = json.data?.attributes?.price
  if (typeof price !== 'number') {
    throw new Error('Kaspi API вернул ответ без цены товара')
  }
  return price
}
