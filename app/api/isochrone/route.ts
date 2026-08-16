import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const ORS_URL = 'https://api.openrouteservice.org/v2/isochrones/driving-car'

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

export async function POST(request: NextRequest) {
  const routeClient = await createRouteClient()
  const {
    data: { user },
    error: authError,
  } = await routeClient.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const apiKey = process.env.ORS_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ORS_API_KEY не настроен на сервере' },
      { status: 500 }
    )
  }

  let body: { lat?: number; lng?: number; ranges?: number[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Некорректное тело запроса' }, { status: 400 })
  }

  const { lat, lng, ranges } = body

  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return NextResponse.json(
      { error: 'lat и lng обязательны и должны быть числами' },
      { status: 400 }
    )
  }
  if (!Array.isArray(ranges) || ranges.length === 0 || !ranges.every((r) => typeof r === 'number')) {
    return NextResponse.json(
      { error: 'ranges обязателен и должен быть непустым массивом чисел (секунды)' },
      { status: 400 }
    )
  }

  let orsResponse: Response
  try {
    orsResponse = await fetch(ORS_URL, {
      method: 'POST',
      headers: {
        Authorization: apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        locations: [[lng, lat]],
        range: ranges,
        range_type: 'time',
      }),
    })
  } catch {
    return NextResponse.json(
      { error: 'Не удалось связаться с сервисом изохрон (openrouteservice)' },
      { status: 502 }
    )
  }

  if (!orsResponse.ok) {
    let details = ''
    try {
      const errorBody = await orsResponse.json()
      details = errorBody?.error?.message ?? JSON.stringify(errorBody)
    } catch {
      details = await orsResponse.text().catch(() => '')
    }
    return NextResponse.json(
      {
        error: `Сервис изохрон вернул ошибку (${orsResponse.status})${details ? ': ' + details : ''}`,
      },
      { status: orsResponse.status }
    )
  }

  const geojson = await orsResponse.json()
  return NextResponse.json(geojson)
}
