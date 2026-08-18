import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { sendAdminNotification } from '@/lib/notify'

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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Уведомление администратору о новой заявке на доступ. Вызывается уже
// залогиненным, только что зарегистрированным пользователем. Ошибка отправки
// НЕ ломает ответ — всегда 200 с флагом sent: true/false.
export async function POST(request: NextRequest) {
  const supabase = await createRouteClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ sent: false, error: 'Не авторизован' }, { status: 401 })
  }

  let body: { role?: string; name?: string; phone?: string; organization?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ sent: false }, { status: 200 })
  }

  const role: 'seller' | 'courier' = body?.role === 'courier' ? 'courier' : 'seller'
  const roleLabel = role === 'courier' ? 'курьер' : 'магазин'
  const name = escapeHtml(String(body?.name ?? '').slice(0, 200)) || '—'
  const phone = escapeHtml(String(body?.phone ?? '').slice(0, 50)) || '—'
  const organization = escapeHtml(String(body?.organization ?? '').slice(0, 200)) || '—'
  const when = new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Almaty' })
  const accessUrl = new URL('/admin/access', request.url).toString()

  const subject = `KanExpress: новая заявка на доступ — ${roleLabel}`
  const html = `
    <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color:#111827; line-height:1.5;">
      <h2 style="margin:0 0 12px; font-size:18px;">Новая заявка на доступ — ${roleLabel}</h2>
      <table style="border-collapse:collapse; font-size:14px;">
        <tr><td style="padding:4px 12px 4px 0; color:#6b7280;">Роль</td><td style="padding:4px 0; font-weight:600;">${roleLabel}</td></tr>
        <tr><td style="padding:4px 12px 4px 0; color:#6b7280;">Имя</td><td style="padding:4px 0; font-weight:600;">${name}</td></tr>
        <tr><td style="padding:4px 12px 4px 0; color:#6b7280;">Телефон</td><td style="padding:4px 0; font-weight:600;">${phone}</td></tr>
        <tr><td style="padding:4px 12px 4px 0; color:#6b7280;">Организация</td><td style="padding:4px 0; font-weight:600;">${organization}</td></tr>
        <tr><td style="padding:4px 12px 4px 0; color:#6b7280;">Дата и время</td><td style="padding:4px 0; font-weight:600;">${escapeHtml(when)}</td></tr>
      </table>
      <p style="margin:16px 0 0; font-size:14px;">
        <a href="${accessUrl}" style="display:inline-block; background:#dc2626; color:#fff; text-decoration:none; padding:10px 16px; border-radius:8px; font-weight:600;">
          Открыть управление доступом
        </a>
      </p>
      <p style="margin:8px 0 0; font-size:12px; color:#9ca3af;">${escapeHtml(accessUrl)}</p>
    </div>
  `

  const { sent } = await sendAdminNotification({ subject, html })
  return NextResponse.json({ sent })
}
