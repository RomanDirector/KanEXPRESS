import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Серверная защита роутов (вторая линия обороны — клиентские guard'ы в layouts
// остаются на месте). В Next.js 16 файл-конвенция middleware переименована в
// proxy (см. node_modules/next/dist/docs/.../file-conventions/proxy.md), поэтому
// файл называется proxy.ts и экспортирует функцию proxy — старое имя middleware
// в 16-й версии помечено deprecated и может игнорироваться.
//
// Логика: нет сессии → /login. Для /admin/* дополнительно требуется запись в
// таблице admins (та же проверка, что в клиентском app/admin/layout.tsx). Роли
// seller/courier здесь НЕ проверяются — это делают layouts, не дублируем.
export async function proxy(request: NextRequest) {
  // response переприсваивается в setAll, чтобы обновлённые supabase-cookie
  // (авто-refresh токена) уехали обратно в браузер вместе с ответом.
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    const { data: admin } = await supabase
      .from('admins')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()

    if (!admin) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    '/admin',
    '/admin/:path*',
    '/dashboard',
    '/invoices',
    '/orders-map',
    '/delivery-zones',
    '/boxes',
    '/scan',
    '/tracking',
    '/demping',
    '/stats',
    '/staff',
    '/archive',
    '/cancelled',
    '/profile',
    '/returns',
    '/zones',
    '/warehouse',
    '/courier-dashboard',
    '/courier-map',
    '/courier-profile',
    '/courier-scan',
    '/courier-stats',
    '/courier-cancelled',
  ],
}
