import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

const TERMINAL_STAGES = ['delivered', 'returned', 'cancelled']

export async function GET(request: NextRequest) {
  const orderNumber = request.nextUrl.searchParams.get('order_number')?.trim()

  if (!orderNumber) {
    return NextResponse.json(
      { error: 'Параметр order_number обязателен' },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()
  const { data: order, error } = await supabase
    .from('orders')
    .select('order_number, status, courier_stage, client_address, created_at, courier_name')
    .eq('order_number', orderNumber)
    .maybeSingle()

  if (error) {
    return NextResponse.json(
      { error: 'Не удалось выполнить поиск заказа' },
      { status: 500 }
    )
  }

  if (!order) {
    return NextResponse.json({ error: 'Заказ не найден' }, { status: 404 })
  }

  let queuePosition = 0
  if (order.courier_name && !TERMINAL_STAGES.includes(order.courier_stage)) {
    const { count, error: queueError } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('courier_name', order.courier_name)
      .not('courier_stage', 'in', `(${TERMINAL_STAGES.join(',')})`)
      .lt('created_at', order.created_at)

    if (queueError) {
      return NextResponse.json(
        { error: 'Не удалось рассчитать позицию в очереди' },
        { status: 500 }
      )
    }
    queuePosition = (count ?? 0) + 1
  }

  return NextResponse.json({
    found: true,
    order_number: order.order_number,
    status: order.status,
    courier_stage: order.courier_stage,
    client_address: order.client_address,
    created_at: order.created_at,
    queue_position: queuePosition,
  })
}
