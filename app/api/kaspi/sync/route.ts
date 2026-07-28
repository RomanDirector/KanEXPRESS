<<<<<<< HEAD
import { NextRequest, NextResponse } from 'next/server'
import { syncKaspiOrders } from '@/lib/kaspi-sync'

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
