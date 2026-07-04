import type { createClient } from '@/lib/supabase'
import type { PendingRegistration } from '@/lib/pending-registration'

type SupabaseClient = ReturnType<typeof createClient>

export type EnsureProfileResult =
  | { success: true }
  | { success: false; error: string }

// Создаёт запись в couriers/sellers с id = userId на основе данных, отложенных
// при регистрации (см. lib/pending-registration.ts). Переиспользуется в /login —
// это единственное место, где после signInWithPassword гарантированно есть
// авторизованная сессия, необходимая RLS-политике для insert.
export async function ensureProfileExists(
  supabase: SupabaseClient,
  userId: string,
  role: PendingRegistration['role'],
  tempData: PendingRegistration,
): Promise<EnsureProfileResult> {
  if (role === 'courier' && tempData.role === 'courier') {
    const { error } = await supabase.from('couriers').insert({
      id: userId,
      full_name: tempData.full_name,
      phone: tempData.phone,
      car_number: tempData.car_number,
    })
    if (error) return { success: false, error: error.message }
    return { success: true }
  }

  if (role === 'seller' && tempData.role === 'seller') {
    const { error } = await supabase.from('sellers').insert({
      id: userId,
      organization_name: tempData.organization_name,
      phone: tempData.phone,
      first_name: tempData.first_name,
      last_name: tempData.last_name,
      org_address: tempData.org_address,
      kaspi_token: tempData.kaspi_token,
      kaspi_shop_id: tempData.kaspi_shop_id,
      promo_code: tempData.promo_code,
    })
    if (error) return { success: false, error: error.message }
    return { success: true }
  }

  return { success: false, error: 'Некорректные данные для создания профиля' }
}
