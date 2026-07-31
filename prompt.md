1. В lib/kaspi.ts, в mapKaspiOrderToRow() — добавь kaspi_order_id: order.id в возвращаемый объект.

2. В lib/kaspi.ts добавь две новые функции (после существующих):

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

3. Создай app/api/kaspi/request-delivery-code/route.ts (POST, body: { orderId }):
   - через createAdminClient() найди order по id, возьми kaspi_order_id, order_number, seller_id
   - если kaspi_order_id пуст — верни 400 "Это не Kaspi-заказ"
   - найди sellers.kaspi_token по seller_id, проверь isValidKaspiToken
   - вызови requestDeliveryCode(), верни { ok: true } или ошибку 500 с текстом

4. Создай app/api/kaspi/confirm-delivery-code/route.ts (POST, body: { orderId, code }):
   - та же подготовка, что в п.3
   - вызови confirmDeliveryCode() с введённым courier'ом code как securityCode
   - при успехе — обнови orders: status='delivered', courier_stage='delivered'
   - при ошибке Kaspi (неверный код/сбой) — верни понятную ошибку клиенту, НЕ трогай статус заказа

5. В app/(courier)/courier-dashboard/page.tsx:
   - у кнопки "Прибыл" (updateStage(order.id, 'arrived')) — если order.kaspi_order_id есть, 
     после успешного обновления stage вызови POST /api/kaspi/request-delivery-code с orderId 
     (это триггерит push клиенту с кодом)
   - confirmDelivery() — вместо локального сравнения entered !== order.kaspi_pickup_code, 
     вызывай POST /api/kaspi/confirm-delivery-code с { orderId: order.id, code: entered }, 
     обрабатывай ответ (успех/ошибка) вместо локальной проверки
   - Если order.kaspi_order_id пуст (заказ создан вручную, не через Kaspi) — оставь текущую 
     локальную логику как fallback, ничего не ломай для тестовых заказов