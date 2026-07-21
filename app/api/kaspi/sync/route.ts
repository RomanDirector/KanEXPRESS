<<<<<<< HEAD
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const KASPI_STATUS_MAP: Record<string, string> = {
  ACCEPTED_BY_MERCHANT: 'pending',
  ASSEMBLE: 'pending',
  KASPI_DELIVERY: 'in_transit',
  DELIVERY: 'in_transit',
  COMPLETED: 'delivered',
}

export async function GET() {
  const token = process.env.KASPI_TOKEN

  if (!token || token === 'будет_от_клиента') {
    return NextResponse.json({
      ok: false,
      message: 'KASPI_TOKEN не настроен. Добавьте токен клиента в .env.local',
    })
  }

  try {
    const response = await fetch(
      'https://kaspi.kz/shop/api/v2/orders?page[number]=0&page[size]=100&filter[orders][state]=NEW',
      {
        headers: {
          'X-Auth-Token': token,
          'Content-Type': 'application/vnd.api+json',
        },
      }
    )

    if (!response.ok) {
      return NextResponse.json({
        ok: false,
        message: 'Kaspi API ошибка: ' + response.status,
      })
    }

    const kaspiData = await response.json()
    const kaspiOrders = kaspiData.data || []

    let imported = 0

    for (const kaspiOrder of kaspiOrders) {
      const attrs = kaspiOrder.attributes || {}

      const orderData = {
        order_number: attrs.code || 'KASPI-' + kaspiOrder.id,
        client_phone: attrs.customer?.cellPhone || '',
        client_address: attrs.deliveryAddress?.formattedAddress || '',
        status: KASPI_STATUS_MAP[attrs.state] || 'pending',
        price: attrs.totalPrice || 0,
        lat: attrs.deliveryAddress?.latitude || null,
        lng: attrs.deliveryAddress?.longitude || null,
      }

      const { error } = await supabase
        .from('orders')
        .upsert(orderData, { onConflict: 'order_number' })

      if (!error) imported++
    }

    return NextResponse.json({
      ok: true,
      message: 'Синхронизация завершена. Импортировано: ' + imported,
      total: kaspiOrders.length,
    })
  } catch (err) {
    return NextResponse.json({
      ok: false,
      message: 'Ошибка: ' + String(err),
    })
  }
}
=======
import { NextRequest, NextResponse } from 'next/server'
import { syncKaspiOrders } from '@/lib/kaspi-sync'

// Запасной вариант ручного/крон-вызова синка через обычный Next.js route —
// основное расписание теперь работает через netlify/functions/kaspi-sync.ts
// (см. netlify.toml), но этот роут оставлен на случай ручного запуска или
// если Netlify Scheduled Function недоступна. Логика общая — см. lib/kaspi-sync.ts.
async function handleSync(request: NextRequest) {
  const sellerId = request.nextUrl.searchParams.get('sellerId') ?? undefined

  try {
    const results = await syncKaspiOrders(sellerId)
    return NextResponse.json({ results })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка синхронизации'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return handleSync(request)
}

export async function POST(request: NextRequest) {
  return handleSync(request)
}
>>>>>>> origin/roman/landing-fixed
