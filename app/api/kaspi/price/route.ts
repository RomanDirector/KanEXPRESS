import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-admin'
import { getSubscriptionState } from '@/lib/limits'
import { updateProductPrice } from '@/lib/kaspi'

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

  let ruleId: string | undefined
  try {
    const body = await request.json()
    ruleId = body?.ruleId
  } catch {
    return NextResponse.json({ error: 'Некорректное тело запроса' }, { status: 400 })
  }

  if (!ruleId) {
    return NextResponse.json({ error: 'Параметр ruleId обязателен' }, { status: 400 })
  }

  let admin: ReturnType<typeof createAdminClient>
  let rule: { id: string; seller_id: string; product_name: string; sku: string | null; current_price: number }
  try {
    admin = createAdminClient()

    // seller_id берём из самого правила, а не из тела запроса — телу запроса не доверяем.
    const { data: ruleData, error: ruleErr } = await admin
      .from('demping_rules')
      .select('id, seller_id, product_name, sku, current_price')
      .eq('id', ruleId)
      .maybeSingle()

    if (ruleErr || !ruleData) {
      return NextResponse.json({ error: 'Правило не найдено' }, { status: 404 })
    }
    rule = ruleData
  } catch (err) {
    console.error('[kaspi/price] init failed:', err)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }

  if (rule.seller_id !== user.id) {
    return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 })
  }

  let subscription: Awaited<ReturnType<typeof getSubscriptionState>>
  try {
    // Демпинг — платная функция (Часть Д ТЗ). Блокировка на клиенте — это только UI,
    // без этой проверки истёкшую подписку можно обойти через DevTools, вызвав роут напрямую.
    subscription = await getSubscriptionState(user.id, admin)
  } catch (err) {
    console.error('[kaspi/price] subscription check failed:', err)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
  if (subscription.status === 'expired') {
    return NextResponse.json({ error: 'Подписка истекла, публикация цены недоступна' }, { status: 403 })
  }

  if (!rule.sku) {
    return NextResponse.json({ error: 'У товара не заполнен артикул (SKU)' }, { status: 422 })
  }

  try {
    await updateProductPrice(rule.sku, rule.current_price)

    await admin.from('demping_history').insert({
      rule_id: rule.id,
      product_name: rule.product_name,
      old_price: rule.current_price,
      new_price: rule.current_price,
      triggered_by: 'kaspi_publish',
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[kaspi/price] publish failed:', err)
    // Клиенту — общая формулировка, без токена и деталей ответа Kaspi.
    return NextResponse.json({ error: 'Не удалось опубликовать цену на Kaspi' }, { status: 502 })
  }
}
