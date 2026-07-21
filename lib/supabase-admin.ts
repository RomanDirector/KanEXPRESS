import { createClient } from '@supabase/supabase-js'

// Сервисный клиент для серверных роутов (синк с внешними API, крон-задачи).
// В отличие от lib/supabase.ts работает в обход RLS — только для доверенного
// серверного кода, которому нужно читать/писать данные чужих продавцов.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}
