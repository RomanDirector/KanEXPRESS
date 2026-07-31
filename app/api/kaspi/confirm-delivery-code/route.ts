import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { confirmDeliveryCode, isValidKaspiToken } from '@/lib/kaspi'

export async function POST(request: NextRequest) {
  const { orderId, code } = await request.json().catch(() => ({}))
  if (!orderId || !code) {
    return NextResponse.json({ error: 'orderId и code обязательны' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: order, error } = await supabase
    .from('orders')
    .select('id, kaspi_order_id, order_number, seller_id')
    .eq('id', orderId)
    .maybeSingle()

  if (error || !order) {
    return NextResponse.json({ error: 'Заказ не найден' }, { status: 404 })
  }

  if (!order.kaspi_order_id) {
    return NextResponse.json({ error: 'Это не Kaspi-заказ' }, { status: 400 })
  }

  const { data: seller, error: sellerError } = await supabase
    .from('sellers')
    .select('kaspi_token')
    .eq('id', order.seller_id)
    .maybeSingle()

  if (sellerError || !seller || !isValidKaspiToken(seller.kaspi_token)) {
    return NextResponse.json({ error: 'kaspi_token не задан' }, { status: 400 })
  }

  try {
    await confirmDeliveryCode({
      token: seller.kaspi_token,
      kaspiOrderId: order.kaspi_order_id,
      orderCode: order.order_number,
      securityCode: code,
    })
  } catch (err) {
    // Ошибка Kaspi (неверный код/сбой) — статус заказа не трогаем, отдаём причину клиенту.
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  const { error: updateError } = await supabase
    .from('orders')
    .update({ status: 'delivered', courier_stage: 'delivered' })
    .eq('id', orderId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
