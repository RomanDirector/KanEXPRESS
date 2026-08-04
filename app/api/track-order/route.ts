import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

// Активные (ещё не завершённые) стадии — используются для расчёта очереди у курьера
const TERMINAL_STAGES = ['delivered', 'returned', 'cancelled']

export async function GET(request: NextRequest) {
  const orderNumber = request.nextUrl.searchParams.get('order_number')?.trim()
  const phoneLast4 = request.nextUrl.searchParams.get('phone_last4')?.trim()

  if (!orderNumber || !phoneLast4) {
    return NextResponse.json(
      { error: 'Параметры order_number и phone_last4 обязательны' },
      { status: 400 }
    )
  }

  if (!/^\d{4}$/.test(phoneLast4)) {
    return NextResponse.json(
      { error: 'phone_last4 должен состоять из 4 цифр' },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  const { data: order, error } = await supabase
    .from('orders')
    .select('order_number, status, courier_stage, client_address, client_phone, created_at, courier_name')
    .eq('order_number', orderNumber)
    .maybeSingle()

  if (error) {
    return NextResponse.json(
      { error: 'Не удалось выполнить поиск заказа' },
      { status: 500 }
    )
  }

  // Сверяем последние 4 цифры телефона на сервере. Не найден заказ и неверный
  // телефон дают одинаковый 404 — иначе по коду ответа можно было бы понять,
  // что номер заказа угадан верно, а телефон нет.
  const orderPhoneLast4 = order?.client_phone?.replace(/\D/g, '').slice(-4) ?? ''
  if (!order || orderPhoneLast4 !== phoneLast4) {
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
    // +1: count — это число заказов перед этим, а фронт показывает
    // "Ваш заказ #{position}" как позицию/ранг в очереди (1 = следующий),
    // а не количество заказов впереди.
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
