import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-admin'
import { isValidKaspiToken } from '@/lib/kaspi'

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

// Токен продавца никогда не отдаётся клиенту обратно — только статус "настроен/не настроен".
// Shop ID не секрет, его можно отдавать и подгружать в форму как есть.
export async function GET() {
  const supabase = await createRouteClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: seller, error } = await admin
    .from('sellers')
    .select('kaspi_token, kaspi_shop_id')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    console.error('[kaspi-credentials] load failed:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }

  return NextResponse.json({
    shopId: seller?.kaspi_shop_id ?? '',
    tokenConfigured: isValidKaspiToken(seller?.kaspi_token),
  })
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

  let body: { shopId?: string; token?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Некорректное тело запроса' }, { status: 400 })
  }

  const update: { kaspi_shop_id?: string; kaspi_token?: string } = {}
  if (typeof body.shopId === 'string') {
    update.kaspi_shop_id = body.shopId.trim()
  }
  // Пустое поле токена в форме — значит "не менять", а не "стереть": продавец
  // не видит текущий токен, поэтому пустое значение не должно затирать сохранённый.
  if (typeof body.token === 'string' && body.token.trim() !== '') {
    update.kaspi_token = body.token.trim()
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: true })
  }

  const admin = createAdminClient()
  const { error } = await admin.from('sellers').update(update).eq('id', user.id)

  if (error) {
    console.error('[kaspi-credentials] save failed:', error)
    return NextResponse.json({ error: 'Не удалось сохранить данные Kaspi' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
