import { NextRequest, NextResponse } from 'next/server'
import { syncKaspiOrders } from '@/lib/kaspi-sync'

// Запасной вариант ручного/крон-вызова синка через обычный Next.js route —
// основное расписание теперь работает через netlify/functions/kaspi-sync.ts
// (см. netlify.toml), но этот роут оставлен на случай ручного запуска или
// если Netlify Scheduled Function недоступна. Логика общая — см. lib/kaspi-sync.ts.
//
// Роут не привязан к пользовательской сессии (дёргается внешним планировщиком,
// не продавцом из браузера) — вместо неё требуется секрет в заголовке
// x-cron-secret, сверяемый с KASPI_SYNC_SECRET. Без настроенного секрета
// доступ закрыт полностью (fail closed), чтобы синк всех продавцов разом
// нельзя было запустить кому попало.
function isAuthorized(request: NextRequest): boolean {
  const configuredSecret = process.env.KASPI_SYNC_SECRET
  if (!configuredSecret) return false
  return request.headers.get('x-cron-secret') === configuredSecret
}

async function handleSync(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

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
