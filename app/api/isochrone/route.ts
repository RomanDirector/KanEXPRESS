import { NextRequest, NextResponse } from 'next/server'

const ORS_URL = 'https://api.openrouteservice.org/v2/isochrones/driving-car'

export async function POST(request: NextRequest) {
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
