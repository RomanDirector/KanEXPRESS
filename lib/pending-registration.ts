import type { createClient } from '@/lib/supabase'

type SupabaseClient = ReturnType<typeof createClient>

// Черновик анкеты регистрации, отложенный до подтверждения email.
// supabase.auth.signUp() не даёт активную сессию, пока пользователь не перейдёт
// по ссылке из письма — значит insert в couriers/sellers сразу после signUp
// будет заблокирован RLS (auth.uid() ещё NULL). Храним черновик в таблице
// pending_registrations (а не в localStorage), чтобы подтверждение и логин
// с другого устройства тоже могли досоздать профиль.

export interface PendingCourierRegistration {
  role: 'courier'
  full_name: string
  phone: string
  car_number: string
}

export interface PendingSellerRegistration {
  role: 'seller'
  organization_name: string
  phone: string
  first_name: string
  last_name: string
  org_address: string
  kaspi_token: string
  kaspi_shop_id: string
  promo_code: string
}

export type PendingRegistration = PendingCourierRegistration | PendingSellerRegistration

export async function savePendingRegistration(
  supabase: SupabaseClient,
  authUserId: string,
  data: PendingRegistration,
) {
  const { role, ...formData } = data

  // Отладка RLS: сессии на этом шаге обычно ещё нет (почта не подтверждена),
  // это ожидаемо — insert должен проходить и без неё благодаря permissive-политике.
  const { data: sessionData } = await supabase.auth.getSession()
  console.log('[pending_registrations insert] auth_user_id:', authUserId)
  console.log('[pending_registrations insert] getSession().session:', sessionData.session)

  const { error } = await supabase.from('pending_registrations').insert({
    auth_user_id: authUserId,
    role,
    form_data: formData,
  })

  if (error) {
    console.log('[pending_registrations insert] error:', error)
  }

  return error
}

interface PendingRegistrationRow {
  id: string
  role: PendingRegistration['role']
  form_data: Record<string, unknown>
}

export async function getPendingRegistration(
  supabase: SupabaseClient,
  authUserId: string,
): Promise<{ id: string; data: PendingRegistration } | null> {
  const { data, error } = await supabase
    .from('pending_registrations')
    .select('id, role, form_data')
    .eq('auth_user_id', authUserId)
    .maybeSingle()

  if (error || !data) return null

  const row = data as PendingRegistrationRow

  return {
    id: row.id,
    data: { role: row.role, ...row.form_data } as PendingRegistration,
  }
}

export async function clearPendingRegistration(supabase: SupabaseClient, id: string) {
  await supabase.from('pending_registrations').delete().eq('id', id)
}
