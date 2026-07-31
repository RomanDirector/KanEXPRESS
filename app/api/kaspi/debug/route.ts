import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-admin'
import { fetchKaspiOrdersRaw, isValidKaspiToken } from '@/lib/kaspi'

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

// ВРЕМЕННЫЙ debug-роут — удалить после сверки полей ответа Kaspi Merchant API
// с тем, что захардкожено в lib/kaspi.ts (code, customer.cellPhone,
// deliveryAddress.formattedAddress/latitude/longitude, state).
// Возвращает сырой JSON без обработки, включая реальные ПДн клиента —
// не оставлять в проде, не публиковать этот ответ никуда наружу.
export async function GET(request: NextRequest) {
  // sellerId берём только из серверной сессии — query-параметр ?sellerId= игнорируется намеренно.
  const routeClient = await createRouteClient()
  const {
    data: { user },
    error: authError,
  } = await routeClient.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const sellerId = user.id

  const supabase = createAdminClient()
  const { data: seller, error } = await supabase
    .from('sellers')
    .select('id, kaspi_token, kaspi_shop_id')
    .eq('id', sellerId)
    .maybeSingle()

  if (error || !seller) {
    return NextResponse.json({ error: 'Продавец не найден' }, { status: 404 })
  }

  if (!isValidKaspiToken(seller.kaspi_token)) {
    return NextResponse.json({ error: 'kaspi_token не задан' }, { status: 400 })
  }

  try {
    const raw = await fetchKaspiOrdersRaw({
      token: seller.kaspi_token,
      shopId: seller.kaspi_shop_id ?? '',
    })
    return NextResponse.json(raw)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
