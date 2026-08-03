import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { syncKaspiOrders } from '@/lib/kaspi-sync'

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

// Ручной запуск той же логики, что и netlify/functions/kaspi-sync.ts — для
// тестирования без ожидания расписания (например, кнопка «Синхронизировать
// сейчас» в кабинете продавца: POST /api/kaspi/sync-manual).
export async function POST(request: NextRequest) {
  // sellerId берём только из серверной сессии — query-параметр ?sellerId= игнорируется намеренно,
  // иначе можно было бы запустить синк чужого магазина или (без параметра) сразу всех продавцов.
  const routeClient = await createRouteClient()
  const {
    data: { user },
    error: authError,
  } = await routeClient.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const sellerId = user.id

  try {
    const results = await syncKaspiOrders(sellerId)
    return NextResponse.json({ results })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка синхронизации'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
