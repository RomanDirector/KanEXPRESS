import { NextRequest, NextResponse } from 'next/server'
import { geocodeAddress } from '@/lib/geocode'

// Тонкая обёртка над lib/geocode.ts (использует сервисный supabase-клиент,
// поэтому не может вызываться напрямую из клиентских компонентов).
export async function POST(request: NextRequest) {
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
