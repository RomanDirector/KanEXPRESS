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
  full_name: string
  organization_address: string
  kaspi_token: string
  kaspi_shop_id: string
}

export type PendingRegistration = PendingCourierRegistration | PendingSellerRegistration

export async function savePendingRegistration(
  supabase: SupabaseClient,
  authUserId: string,
  data: PendingRegistration,
  maxAttempts = 3,
) {
  const { role, ...formData } = data

  // auth.users иногда становится видимым для FK-проверки на стороне Supabase
  // с небольшой задержкой после того, как signUp() уже вернул ответ клиенту —
  // поэтому insert может словить 23503 (foreign_key_violation) даже когда
  // пользователь реально создан. Ретраим на этот конкретный код ошибки.
  let error: { code?: string; message: string } | null = null

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await supabase.from('pending_registrations').insert({
      auth_user_id: authUserId,
      role,
      form_data: formData,
    })

    error = result.error
    if (!error) return null

    if (error.code === '23503' && attempt < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 400 * attempt))
      continue
    }

    break
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
