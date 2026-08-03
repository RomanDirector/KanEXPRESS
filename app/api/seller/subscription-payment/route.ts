import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-admin'

const SUBSCRIPTION_AMOUNT = 10000

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

// Создаёт ТОЛЬКО заявку на оплату (status='pending'). Это намеренно не активирует
// подписку — ручной перевод на Kaspi подтверждается человеком, активация делается
// вручную через SQL после проверки поступления денег. Автоматическая активация
// здесь была бы дырой в монетизации (любой может нажать "Я оплатил" не заплатив).
export async function POST(request: NextRequest) {
  const supabase = await createRouteClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  let body: { contact?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Некорректное тело запроса' }, { status: 400 })
  }

  const contact = (body.contact || '').trim()
  if (!contact) {
    return NextResponse.json({ error: 'Укажите email или телефон для сверки платежа' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('payment_history')
    .insert({
      seller_id: user.id,
      amount: SUBSCRIPTION_AMOUNT,
      plan: 'pro',
      status: 'pending',
      payer_contact: contact,
    })
    .select('id, amount, plan, status, created_at')
    .single()

  if (error) {
    console.error('[subscription-payment] insert failed:', error)
    return NextResponse.json({ error: 'Не удалось отправить заявку' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, payment: data })
}
