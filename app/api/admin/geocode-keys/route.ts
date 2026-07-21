import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

// Управление пулом ключей геокодирования (сейчас — 2GIS).
// Временная защита для MVP: доступ только email из ADMIN_EMAILS,
// пока нет полноценной системы ролей admin.

function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

async function requireAdmin(request: NextRequest) {
  const authHeader = request.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) return null

  const supabase = createAdminClient()
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user?.email) return null

  if (!getAdminEmails().includes(data.user.email.toLowerCase())) return null

  return data.user
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) {
    return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('geocode_api_keys')
    .select('id, key, provider, exhausted_at, created_at')
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const keys = (data ?? []).map(({ key, ...rest }) => ({
    ...rest,
    key_preview: key.length > 7 ? `${key.slice(0, 3)}***${key.slice(-4)}` : '***',
  }))

  return NextResponse.json({ keys })
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) {
    return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 })
  }

  let body: { key?: string; provider?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Некорректное тело запроса' }, { status: 400 })
  }

  const key = body.key?.trim()
  const provider = body.provider?.trim() || '2gis'

  if (!key) {
    return NextResponse.json({ error: 'key обязателен' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { error } = await supabase.from('geocode_api_keys').insert({ key, provider })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) {
    return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 })
  }

  const id = request.nextUrl.searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'id обязателен' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { error } = await supabase.from('geocode_api_keys').delete().eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
