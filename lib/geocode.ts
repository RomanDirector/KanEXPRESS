import { createAdminClient } from '@/lib/supabase-admin'

// Геокодирование адресов через 2GIS с кэшем в geocoded_addresses и пулом
// ключей в geocode_api_keys (автопереключение при исчерпании лимита).
// Пока не подключено никуда — подготовка для будущей синхронизации Kaspi.

const ALMATY_CENTER = { lat: 43.238949, lon: 76.889709 }
const ALMATY_BOUNDS = { latMin: 43.1, latMax: 43.45, lngMin: 76.6, lngMax: 77.2 }
const MAX_KEY_ATTEMPTS = 5
const KEY_RESET_INTERVAL_MS = 24 * 60 * 60 * 1000

export type GeocodeResult =
  | { success: true; lat: number; lng: number; display_name: string; provider: '2gis' }
  | { success: false; error: string }

interface TwoGisItem {
  point?: { lat: number; lon: number }
  full_name?: string
}

interface TwoGisResponse {
  meta?: { code?: number; error?: unknown }
  result?: { items?: TwoGisItem[] }
}

function normalizeAddress(address: string): string {
  return address.trim().toLowerCase().replace(/\s+/g, ' ')
}

function isWithinAlmaty(lat: number, lon: number): boolean {
  return (
    lat >= ALMATY_BOUNDS.latMin &&
    lat <= ALMATY_BOUNDS.latMax &&
    lon >= ALMATY_BOUNDS.lngMin &&
    lon <= ALMATY_BOUNDS.lngMax
  )
}

const KEYS_EXHAUSTED_ERROR = 'Все ключи 2GIS исчерпаны, добавьте новый в /admin/geocode-keys'

export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  const normalized = normalizeAddress(address)
  const supabase = createAdminClient()

  const { data: cached } = await supabase
    .from('geocoded_addresses')
    .select('lat, lng, display_name')
    .eq('address_normalized', normalized)
    .maybeSingle()

  if (cached) {
    return {
      success: true,
      lat: cached.lat,
      lng: cached.lng,
      display_name: cached.display_name,
      provider: '2gis',
    }
  }

  const resetThreshold = new Date(Date.now() - KEY_RESET_INTERVAL_MS).toISOString()

  const { data: keys } = await supabase
    .from('geocode_api_keys')
    .select('id, key')
    .eq('provider', '2gis')
    .or(`exhausted_at.is.null,exhausted_at.lt.${resetThreshold}`)
    .order('created_at', { ascending: true })
    .limit(MAX_KEY_ATTEMPTS)

  if (!keys || keys.length === 0) {
    return { success: false, error: KEYS_EXHAUSTED_ERROR }
  }

  for (const apiKey of keys) {
    const url = new URL('https://catalog.api.2gis.com/3.0/items/geocode')
    url.searchParams.set('q', `Алматы, ${address}`)
    url.searchParams.set('fields', 'items.point,items.full_name,items.address')
    url.searchParams.set('location_bias_latlon', `${ALMATY_CENTER.lat},${ALMATY_CENTER.lon}`)
    url.searchParams.set('location_bias_radius', '30000')
    url.searchParams.set('key', apiKey.key)

    let response: Response
    try {
      response = await fetch(url.toString())
    } catch {
      continue
    }

    if (response.status === 403) {
      await supabase
        .from('geocode_api_keys')
        .update({ exhausted_at: new Date().toISOString() })
        .eq('id', apiKey.id)
      continue
    }

    const json: TwoGisResponse = await response.json().catch(() => ({}))

    if (!response.ok || json.meta?.error) {
      await supabase
        .from('geocode_api_keys')
        .update({ exhausted_at: new Date().toISOString() })
        .eq('id', apiKey.id)
      continue
    }

    const match = (json.result?.items ?? []).find(
      (item) => item.point && isWithinAlmaty(item.point.lat, item.point.lon),
    )

    if (!match?.point) {
      return { success: false, error: 'not_found' }
    }

    const displayName = match.full_name ?? address

    await supabase.from('geocoded_addresses').upsert(
      {
        address_normalized: normalized,
        address_original: address,
        lat: match.point.lat,
        lng: match.point.lon,
        display_name: displayName,
        provider: '2gis',
      },
      { onConflict: 'address_normalized' },
    )

    return {
      success: true,
      lat: match.point.lat,
      lng: match.point.lon,
      display_name: displayName,
      provider: '2gis',
    }
  }

  return { success: false, error: KEYS_EXHAUSTED_ERROR }
}
