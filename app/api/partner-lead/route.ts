import { NextRequest, NextResponse } from 'next/server'

// Партнёрской программы (промокоды, выплаты) в системе пока нет — заявка
// просто логируется на сервере, чтобы её можно было забрать вручную, пока
// нет собственного бэкенда под неё.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)

  if (!body || typeof body.phone !== 'string' || !body.phone.trim()) {
    return NextResponse.json({ error: 'Номер телефона обязателен' }, { status: 400 })
  }

  console.log('[partner-lead] Новая заявка «Стать партнёром»:', {
    phone: body.phone,
    email: body.email ?? null,
    firstName: body.firstName ?? null,
    lastName: body.lastName ?? null,
    middleName: body.middleName ?? null,
    receivedAt: new Date().toISOString(),
  })

  return NextResponse.json({ ok: true })
}
