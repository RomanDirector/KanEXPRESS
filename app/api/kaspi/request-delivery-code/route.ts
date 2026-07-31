import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { requestDeliveryCode, isValidKaspiToken } from '@/lib/kaspi'

export async function POST(request: NextRequest) {
  const { orderId } = await request.json().catch(() => ({}))
  if (!orderId) {
    return NextResponse.json({ error: 'orderId обязателен' }, { status: 400 })
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
    await requestDeliveryCode({
      token: seller.kaspi_token,
      kaspiOrderId: order.kaspi_order_id,
      orderCode: order.order_number,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
