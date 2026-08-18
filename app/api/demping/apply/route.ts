import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-admin'
import { getSubscriptionState } from '@/lib/limits'

// Серверный гейт изменения цен демпинга. Раньше decreaseOnce/recalcByCompetitor
// писали новую цену в demping_rules прямо с клиента — RLS проверяет seller_id, но
// НЕ статус подписки, поэтому истёкшую подписку можно было обойти через DevTools.
// Здесь проверка идёт по цепочке: сессия → владение правилом → статус подписки —
// и только потом запись в БД. Новая цена считается на сервере из состояния правила
// в БД, телу запроса цена не доверяется. Публикация на Kaspi остаётся в уже
// защищённом /api/kaspi/price (клиент дергает его отдельно после успешного apply).

type Action = 'decrease' | 'competitor'

interface RuleRow {
  id: string
  seller_id: string
  product_name: string
  current_price: number
  min_price: number
  max_price: number
  step: number
  competitor_price: number | null
  follow_competitor: boolean
  follow_step: number
  is_active: boolean
}

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

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

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
  let action: Action | undefined
  try {
    const body = await request.json()
    ruleId = body?.ruleId
    action = body?.action
  } catch {
    return NextResponse.json({ error: 'Некорректное тело запроса' }, { status: 400 })
  }

  if (!ruleId || (action !== 'decrease' && action !== 'competitor')) {
    return NextResponse.json({ error: 'Некорректные параметры запроса' }, { status: 400 })
  }

  let admin: ReturnType<typeof createAdminClient>
  let rule: RuleRow
  try {
    admin = createAdminClient()
    // seller_id берём из самого правила, а не из тела запроса — телу не доверяем.
    const { data: ruleData, error: ruleErr } = await admin
      .from('demping_rules')
      .select(
        'id, seller_id, product_name, current_price, min_price, max_price, step, competitor_price, follow_competitor, follow_step, is_active'
      )
      .eq('id', ruleId)
      .maybeSingle()

    if (ruleErr || !ruleData) {
      return NextResponse.json({ error: 'Правило не найдено' }, { status: 404 })
    }
    rule = ruleData as RuleRow
  } catch (err) {
    console.error('[demping/apply] init failed:', err)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }

  if (rule.seller_id !== user.id) {
    return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 })
  }

  let subscription: Awaited<ReturnType<typeof getSubscriptionState>>
  try {
    subscription = await getSubscriptionState(user.id, admin)
  } catch (err) {
    console.error('[demping/apply] subscription check failed:', err)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
  if (subscription.status === 'expired') {
    return NextResponse.json(
      { error: 'Подписка истекла — изменение цены недоступно' },
      { status: 403 }
    )
  }

  // Неактивное правило не двигаем — та же семантика, что в клиентских guard'ах.
  if (!rule.is_active) {
    return NextResponse.json({ ok: true, skipped: true, oldPrice: rule.current_price, newPrice: rule.current_price })
  }

  let newPrice: number
  let triggeredBy: 'manual' | 'competitor_follow'

  if (action === 'decrease') {
    if (rule.current_price <= rule.min_price) {
      return NextResponse.json({ ok: true, skipped: true, oldPrice: rule.current_price, newPrice: rule.current_price })
    }
    newPrice = clamp(rule.current_price - rule.step, rule.min_price, rule.max_price)
    triggeredBy = 'manual'
  } else {
    if (!rule.follow_competitor || rule.competitor_price == null || rule.current_price < rule.competitor_price) {
      return NextResponse.json({ ok: true, skipped: true, oldPrice: rule.current_price, newPrice: rule.current_price })
    }
    newPrice = clamp(rule.competitor_price - rule.follow_step, rule.min_price, rule.max_price)
    triggeredBy = 'competitor_follow'
  }

  if (newPrice === rule.current_price) {
    return NextResponse.json({ ok: true, skipped: true, oldPrice: rule.current_price, newPrice })
  }

  try {
    const { error: updateErr } = await admin
      .from('demping_rules')
      .update({ current_price: newPrice })
      .eq('id', rule.id)
      .eq('seller_id', user.id)
    if (updateErr) {
      console.error('[demping/apply] price update failed:', updateErr)
      return NextResponse.json({ error: 'Не удалось сохранить цену' }, { status: 500 })
    }

    const { error: historyErr } = await admin.from('demping_history').insert({
      rule_id: rule.id,
      product_name: rule.product_name,
      old_price: rule.current_price,
      new_price: newPrice,
      triggered_by: triggeredBy,
    })
    if (historyErr) {
      // История — не критично для самого изменения цены, логируем и продолжаем.
      console.error('[demping/apply] history insert failed:', historyErr)
    }

    return NextResponse.json({ ok: true, skipped: false, oldPrice: rule.current_price, newPrice })
  } catch (err) {
    console.error('[demping/apply] apply failed:', err)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}
