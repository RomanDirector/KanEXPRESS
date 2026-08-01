import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-admin'
import { confirmDeliveryCode, isValidKaspiToken } from '@/lib/kaspi'

async function createRouteClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            // Route Handler может отдавать уже отправленный ответ — обновление cookie тогда не нужно.
          }
        },
      },
    }
  )
}

export async function POST(request: NextRequest) {
  const supabase = await createRouteClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const { orderId, code } = await request.json().catch(() => ({}))
  if (!orderId || !code) {
    return NextResponse.json({ error: 'orderId и code обязательны' }, { status: 400 })
  }

  const { data: courier, error: courierError } = await supabase
    .from('couriers')
    .select('id, full_name')
    .eq('id', user.id)
    .maybeSingle()

  if (courierError || !courier) {
    return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data: order, error } = await admin
    .from('orders')
    .select('id, kaspi_order_id, order_number, seller_id, courier_name')
    .eq('id', orderId)
    .maybeSingle()

  if (error || !order) {
    return NextResponse.json({ error: 'Заказ не найден' }, { status: 404 })
  }

  if ((order.courier_name ?? '').trim().toLowerCase() !== courier.full_name.trim().toLowerCase()) {
    return NextResponse.json({ error: 'Этот заказ не назначен вам' }, { status: 403 })
  }

  if (!order.kaspi_order_id) {
    return NextResponse.json({ error: 'Это не Kaspi-заказ' }, { status: 400 })
  }

  const { data: seller, error: sellerError } = await admin
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

  const { error: updateError } = await admin
    .from('orders')
    .update({ status: 'delivered', courier_stage: 'delivered' })
    .eq('id', orderId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
