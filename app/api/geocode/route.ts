import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { geocodeAddress } from '@/lib/geocode'

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

// Тонкая обёртка над lib/geocode.ts (использует сервисный supabase-клиент,
// поэтому не может вызываться напрямую из клиентских компонентов).
export async function POST(request: NextRequest) {
  const routeClient = await createRouteClient()
  const {
    data: { user },
    error: authError,
  } = await routeClient.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Не авторизован' }, { status: 401 })
  }

  let body: { address?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Некорректное тело запроса' }, { status: 400 })
  }

  const address = body.address?.trim()
  if (!address) {
    return NextResponse.json({ success: false, error: 'address обязателен' }, { status: 400 })
  }

  const result = await geocodeAddress(address)
  return NextResponse.json(result)
}
