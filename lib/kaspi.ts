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
  // Реальный жизненный цикл заказа — отдельное от state поле (см. mapKaspiOrderState
  // ниже). Проверено на живых данных продавца: у 98% заказов state='ARCHIVE' и
  // единственное, что различает доставлен/отменён/возвращён — именно status.
  status?: string
  cancellationReason?: string
  creationDate: number
  plannedDeliveryDate?: number
  totalPrice?: number
  phoneAlias?: string
  customer?: { cellPhone?: string }
  deliveryAddress?: { formattedAddress?: string; latitude?: number; longitude?: number }
  isKaspiDelivery?: boolean
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

    // TODO(kaspi-delivery-mode): разведка — сверить, есть ли в ответе Kaspi поле
    // способа доставки (deliveryMode или аналог), прежде чем на него полагаться
    // где-либо в фильтрах. Поле isKaspiDelivery найдено и уже используется в фильтре,
    // разведочный console.log ключей attributes убран.

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

// state описывает канал доставки (самовывоз/своя доставка/Kaspi Доставка),
// а не завершённость заказа — проверено на живых данных: KASPI_DELIVERY/DELIVERY
// это единственные state-значения, которые реально означают "в пути" у этого
// продавца. Раньше это была единственная база для статуса; теперь она остаётся
// базой только для НЕтерминальных заказов (см. mapKaspiOrderState) — реальный
// признак "доставлен/отменён/возвращён" даёт status, не state.
function baseStatusFromState(state: string): 'pending' | 'in_transit' {
  return state === 'KASPI_DELIVERY' || state === 'DELIVERY' ? 'in_transit' : 'pending'
}

// Человекочитаемые причины отмены Kaspi (order.cancellationReason — машинный
// код, не готовый текст). Список неполный: в живых данных этого продавца
// встретился только BUYER_CANCELLATION_HIMSELF — остальные коды Kaspi нигде
// не документирует публично, поэтому непереведённый код возвращаем как есть
// (лучше показать сырой код, чем потерять информацию о причине).
const KASPI_CANCEL_REASON_LABEL: Record<string, string> = {
  BUYER_CANCELLATION_HIMSELF: 'Покупатель отменил заказ',
}

export interface MappedKaspiOrderState {
  status: 'pending' | 'in_transit' | 'delivered'
  // null — заказ ещё не в терминальном для нас состоянии, courier_stage
  // трогать не нужно (иначе синк затрёт реальный прогресс курьера в приложении).
  courierStage: 'cancelled' | 'returned' | null
  cancelReason: string | null
}

// order.status — реальный жизненный цикл заказа на стороне Kaspi (см.
// KaspiOrder.status). COMPLETED/CANCELLED/RETURNED — терминальные значения,
// state в этот момент у Kaspi всегда 'ARCHIVE' и сам по себе уже ничего не
// говорит о причине завершения.
export function mapKaspiOrderState(order: KaspiOrder): MappedKaspiOrderState {
  if (order.status === 'COMPLETED') {
    return { status: 'delivered', courierStage: null, cancelReason: null }
  }
  if (order.status === 'CANCELLED') {
    const reason = order.cancellationReason
      ? KASPI_CANCEL_REASON_LABEL[order.cancellationReason] ?? order.cancellationReason
      : null
    return { status: baseStatusFromState(order.state), courierStage: 'cancelled', cancelReason: reason }
  }
  if (order.status === 'RETURNED' || order.status === 'KASPI_DELIVERY_RETURN_REQUESTED') {
    return { status: baseStatusFromState(order.state), courierStage: 'returned', cancelReason: null }
  }
  // APPROVED_BY_BANK, ACCEPTED_BY_MERCHANT, CANCELLING и всё незнакомое — переходные.
  return { status: baseStatusFromState(order.state), courierStage: null, cancelReason: null }
}

export function mapKaspiOrderToRow(
  order: KaspiOrder,
  sellerId: string,
  productName: string | null = null,
  productQuantity: number | null = null
) {
  const phone = order.phoneAlias?.trim() || order.customer?.cellPhone || ''
  const mapped = mapKaspiOrderState(order)
  return {
    seller_id: sellerId,
    kaspi_order_id: order.id,
    order_number: order.code,
    client_phone: phone,
    client_address: order.deliveryAddress?.formattedAddress ?? '',
    product_name: productName,
    product_quantity: productQuantity,
    price: order.totalPrice ?? 0,
    status: mapped.status,
    created_at: new Date(order.creationDate).toISOString(),
    planned_delivery_date: order.plannedDeliveryDate ? new Date(order.plannedDeliveryDate).toISOString() : null,
    lat: order.deliveryAddress?.latitude ?? null,
    lng: order.deliveryAddress?.longitude ?? null,
    is_kaspi_delivery: order.isKaspiDelivery ?? false,
    // courier_stage/cancel_reason/cancelled_by/cancelled_at сюда намеренно НЕ
    // попадают — этот row идёт в общий bulk-upsert, где затирает поля у уже
    // существующих заказов безусловно. Если писать сюда courier_stage прямо
    // тут, то и очередной обычный ресинк уже идущего в приложении заказа
    // сбрасывал бы реальный прогресс курьера (dropped/departed/arrived...)
    // обратно на 'not_started'. Терминальные courier_stage применяются
    // отдельным guarded UPDATE после апсерта — см. applyKaspiTerminalState в
    // lib/kaspi-sync.ts (WHERE courier_stage='not_started', чтобы не
    // затирать уже начатую в приложении доставку).
  }
}

// --- Позиции заказа (название товара) ------------------------------------
// В Kaspi Merchant API позиции заказа НЕ лежат внутри самого объекта заказа:
// их отдают отдельным запросом GET /orders/{id}/entries, а название товара —
// либо прямо в атрибутах позиции (offer.name), либо в связанном ресурсе
// product по ссылке relationships.product.links.related. Поэтому качаем
// позиции отдельно и аккуратно достаём название из обоих возможных мест.

async function kaspiGetJson(token: string, url: string, timeoutMs = 8000): Promise<any> {
  const res = await fetch(url, {
    headers: {
      'X-Auth-Token': token,
      'Content-Type': 'application/vnd.api+json',
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!res.ok) {
    const bodyText = await res.text().catch(() => '')
    throw new Error(`Kaspi API ответил ${res.status}: ${bodyText || url}`)
  }
  return res.json()
}

export interface KaspiOrderEntry {
  name: string
  // Сколько единиц ЭТОЙ позиции реально заказано (attributes.quantity у
  // Kaspi). НЕ путать с offer.name — название товара в каталоге само может
  // содержать текст вроде «, 1 шт» (это фасовка/упаковка конкретного лота,
  // а не количество в заказе): для товара "Клей ..., 1 шт" с quantity=6
  // реальный заказ — 6 упаковок, а не 1, хотя название говорит "1 шт".
  quantity: number
}

// Возвращает позиции заказа (название + фактическое количество). Пустой
// список — позиций нет или у них нет названия (это не ошибка). Бросает,
// только если сам запрос упал — вызывающая сторона (kaspi-sync) ловит это и
// не роняет синк.
export async function fetchKaspiOrderEntries({ token, orderId }: {
  token: string
  orderId: string
}): Promise<KaspiOrderEntry[]> {
  const json = await kaspiGetJson(token, `${KASPI_API_BASE}/orders/${encodeURIComponent(orderId)}/entries`)
  const entries = Array.isArray(json?.data) ? json.data : []
  const result: KaspiOrderEntry[] = []

  for (const entry of entries) {
    const attrs = entry?.attributes ?? {}
    const quantity = typeof attrs?.quantity === 'number' && attrs.quantity > 0 ? attrs.quantity : 1
    // Название часто приходит прямо в позиции (offer.name) — тогда доп. запрос не нужен.
    const inlineName =
      (typeof attrs?.offer?.name === 'string' && attrs.offer.name) ||
      (typeof attrs?.product?.name === 'string' && attrs.product.name) ||
      (typeof attrs?.name === 'string' && attrs.name) ||
      null
    if (inlineName && inlineName.trim()) {
      result.push({ name: inlineName.trim(), quantity })
      continue
    }

    // Инлайн-названия нет — тянем связанный product по ссылке из позиции.
    const productLink: string | undefined =
      entry?.relationships?.product?.links?.related ||
      entry?.relationships?.merchantProduct?.links?.related
    if (!productLink) continue
    try {
      const productJson = await kaspiGetJson(token, productLink)
      const pname = productJson?.data?.attributes?.name
      if (typeof pname === 'string' && pname.trim()) result.push({ name: pname.trim(), quantity })
    } catch (err) {
      // Одна недокачанная позиция не должна ронять весь заказ — пропускаем её.
      console.error(`[kaspi] заказ ${orderId}: не удалось получить товар по ссылке позиции`, err)
    }
  }

  return result
}

// Название товара целиком (без обрезки длины) — одно название либо «первое и
// ещё N», когда позиций несколько. Раньше здесь же обрезали строку до 60
// символов и дописывали «× N» — из-за обрезки в БД сохранялась уже усечённая
// строка, и «развернуть полностью» в UI было нечего показывать (текста после
// «…» просто не существовало). Обрезка под физическое место на накладной —
// теперь забота рендера накладной (lib/invoice-plan.ts), а количество —
// отдельное поле orders.product_quantity (см. sumProductQuantity ниже).
export function formatProductName(entries: KaspiOrderEntry[]): string | null {
  const clean = entries.filter((e) => e.name && e.name.trim())
  if (clean.length === 0) return null
  const first = clean[0].name
  return clean.length === 1 ? first : `${first} и ещё ${clean.length - 1}`
}

// Суммарное количество единиц по всем позициям заказа — отдельное поле
// orders.product_quantity, показывается отдельной строкой "Количество: N" в UI.
export function sumProductQuantity(entries: KaspiOrderEntry[]): number | null {
  if (entries.length === 0) return null
  return entries.reduce((sum, e) => sum + e.quantity, 0)
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
