import { createBrowserClient } from '@supabase/ssr'
import type { Session, SupabaseClient } from '@supabase/supabase-js'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Общий обработчик выхода — используется и десктопным сайдбаром, и мобильной
// кнопкой выхода на страницах профиля, чтобы не дублировать логику signOut.
export async function signOutAndRedirect() {
  await supabase.auth.signOut()
  window.location.href = '/login'
}

// Используется только сразу после signUp(), когда data.session уже пришёл
// непустым — на случай гонки между resolve() промиса и фактической записью
// токена в клиент. НЕ подходит для ожидания сессии, которая появится после
// перехода по ссылке подтверждения email — та сессия возникает на другой
// вкладке/устройстве и onAuthStateChange в этой вкладке о ней не узнает.
export async function waitForActiveSession(
  client: SupabaseClient,
  timeoutMs = 5000,
): Promise<Session | null> {
  const {
    data: { session: current },
  } = await client.auth.getSession()
  if (current) return current

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      subscription.unsubscribe()
      resolve(null)
    }, timeoutMs)

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      if (session) {
        clearTimeout(timeout)
        subscription.unsubscribe()
        resolve(session)
      }
    })
  })
}