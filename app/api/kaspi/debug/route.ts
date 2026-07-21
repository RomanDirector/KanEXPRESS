import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { fetchKaspiOrdersRaw, isValidKaspiToken } from '@/lib/kaspi'

// ВРЕМЕННЫЙ debug-роут — удалить после сверки полей ответа Kaspi Merchant API
// с тем, что захардкожено в lib/kaspi.ts (code, customer.cellPhone,
// deliveryAddress.formattedAddress/latitude/longitude, state).
// Возвращает сырой JSON без обработки, включая реальные ПДн клиента —
// не оставлять в проде, не публиковать этот ответ никуда наружу.
export async function GET(request: NextRequest) {
  const sellerId = request.nextUrl.searchParams.get('sellerId')

  if (!sellerId) {
    return NextResponse.json({ error: 'Укажи ?sellerId=' }, { status: 400 })
  }

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
