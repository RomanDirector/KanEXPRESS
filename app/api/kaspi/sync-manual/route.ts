import { NextRequest, NextResponse } from 'next/server'
import { syncKaspiOrders } from '@/lib/kaspi-sync'

// Ручной запуск той же логики, что и netlify/functions/kaspi-sync.ts — для
// тестирования без ожидания расписания (например, кнопка «Синхронизировать
// сейчас» в кабинете продавца: POST /api/kaspi/sync-manual?sellerId=...).
export async function POST(request: NextRequest) {
  const sellerId = request.nextUrl.searchParams.get('sellerId') ?? undefined

  try {
    const results = await syncKaspiOrders(sellerId)
    return NextResponse.json({ results })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка синхронизации'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
