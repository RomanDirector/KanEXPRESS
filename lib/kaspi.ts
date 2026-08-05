const KASPI_API_BASE = process.env.KASPI_API_BASE || 'https://kaspi.kz/shop/api/v2'
const MAX_PAGES = 50
const PAGE_SIZE = 100
const STUB_TOKENS = new Set(['', 'test', 'demo', 'stub', 'xxx', '-'])

export function isValidKaspiToken(token: string | null | undefined): token is string {
  if (!token) return false
  return !STUB_TOKENS.has(token.trim().toLowerCase())
}

function extractKaspiErrorMessage(bodyText: string): string | null {
  if (!bodyText) return null
  try {
    const parsed = JSON.parse(bodyText)
    const first = parsed?.errors?.[0]
    const detail = first?.detail || first?.title || parsed?.message || parsed?.error
    if (typeof detail === 'string' && detail.trim()) return detail.trim()
  } catch {
  }
  return null
}

export interface KaspiOrder {
  id: string
  code: string
  state: string
  creationDate: number
  totalPrice?: number
  phoneAlias?: string
  customer?: { cellPhone?: string }
  deliveryAddress?: { formattedAddress?: string; latitude?: number; longitude?: number }
}
interface KaspiOrdersResponse {
  data: Array<{ id: string; attributes: Omit<KaspiOrder, 'id'> }>
  meta?: { pageCount?: number }
}

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
    const now = Date.now()
    const lookbackMs = 2 * 24 * 60 * 60 * 1000
    url.searchParams.set('filter[orders][creationDate][$ge]', String(now - lookbackMs))
    url.searchParams.set('filter[orders][creationDate][$le]', String(now))
    const res = await fetch(url.toString(), {
      headers: {
        'X-Auth-Token': token,
        'Content-Type': 'application/vnd.api+json',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      const bodyText = await res.text().catch(() => '')
      console.error(`[kaspi] заказы: ответ ${res.status} (магазин ${shopId || '—'}): ${bodyText}`)
      const detail = extractKaspiErrorMessage(bodyText)
      throw new Error(`Kaspi API ответил ${res.status} (магазин ${shopId || '—'})${detail ? `: ${detail}` : ''}`)
    }
    const json = (await res.json()) as KaspiOrdersResponse
    const pageOrders = json.data.map((item) => ({ id: item.id, ...item.attributes }))
    orders.push(...pageOrders)
    const pageCount = json.meta?.pageCount ?? 1
    if (pageOrders.length === 0 || pageNumber + 1 >= pageCount) break
  }
  return orders
}

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
  const now = Date.now()
  const lookbackMs = 2 * 24 * 60 * 60 * 1000
  url.searchParams.set('filter[orders][creationDate][$ge]', String(now - lookbackMs))
  url.searchParams.set('filter[orders][creationDate][$le]', String(now))
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
  const phone = order.phoneAlias?.trim() || order.customer?.cellPhone || ''
  return {
    seller_id: sellerId,
    kaspi_order_id: order.id,
    order_number: order.code,
    client_phone: phone,
    client_address: order.deliveryAddress?.formattedAddress ?? '',
    price: order.totalPrice ?? 0,
    status: mapKaspiStatus(order.state),
    created_at: new Date(order.creationDate).toISOString(),
    lat: order.deliveryAddress?.latitude ?? null,
    lng: order.deliveryAddress?.longitude ?? null,
  }
}
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

const KASPI_PRICE_ENDPOINTS = {
  product: (sku: string) => `/products/${encodeURIComponent(sku)}`,
}

async function kaspiFetch(token: string, path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${KASPI_API_BASE}${path}`, {
    ...init,
    headers: {
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

export async function updateProductPrice({ token, shopId, sku, price }: {
  token: string; shopId?: string; sku: string; price: number
}): Promise<void> {
  await kaspiFetch(token, KASPI_PRICE_ENDPOINTS.product(sku), {
    method: 'PATCH',
    body: JSON.stringify({
      data: {
        type: 'products',
        id: sku,
        attributes: { price, ...(shopId ? { merchantId: shopId } : {}) },
      },
    }),
  })
}

export async function getProductPrice({ token, sku }: { token: string; sku: string }): Promise<number> {
  const res = await kaspiFetch(token, KASPI_PRICE_ENDPOINTS.product(sku), { method: 'GET' })
  const json = (await res.json()) as { data?: { attributes?: { price?: number } } }
  const price = json.data?.attributes?.price
  if (typeof price !== 'number') {
    throw new Error('Kaspi API вернул ответ без цены товара')
  }
  return price
}
