'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase'
import type { MapZone } from '@/components/MapGL'

const MapGL = dynamic(() => import('@/components/MapGL'), { ssr: false })

interface CourierOption {
  id: string
  full_name: string
}

interface ZoneRow {
  id: string
  name: string
  color: string
  coordinates: GeoJSON.Polygon
  display_number: number | null
  seller_id: string
  organization_name: string | null
  courier_id: string | null
}

export default function AdminZonesPage() {
  const [zones, setZones] = useState<ZoneRow[]>([])
  const [couriers, setCouriers] = useState<CourierOption[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [numberDrafts, setNumberDrafts] = useState<Record<string, string>>({})

  async function loadAll() {
    setLoading(true)
    setLoadError(null)
    // Отдельные запросы вместо embed-джойнов (zones -> sellers, zones -> courier_zones):
    // как и для courier_zones ниже, embed завязан на relationship-кэш PostgREST,
    // а зона <-> продавец через такой join нигде больше в проекте не читается —
    // при отсутствующей/незакэшированной связи весь select падает и страница
    // молча показывает "Зоны не найдены" вместо реальной ошибки.
    const [
      { data: zonesData, error: zonesError },
      { data: sellersData, error: sellersError },
      { data: czData, error: czError },
      { data: couriersData, error: couriersError },
    ] = await Promise.all([
      supabase.from('zones').select('id, name, color, coordinates, display_number, seller_id').order('name'),
      supabase.from('sellers').select('id, organization_name'),
      supabase.from('courier_zones').select('zone_id, courier_id'),
      supabase.from('couriers').select('id, full_name').eq('access_status', 'approved').order('full_name'),
    ])
    if (zonesError) console.error('Ошибка загрузки zones:', zonesError)
    if (sellersError) console.error('Ошибка загрузки sellers:', sellersError)
    if (czError) console.error('Ошибка загрузки courier_zones:', czError)
    if (couriersError) console.error('Ошибка загрузки couriers:', couriersError)

    if (zonesError) {
      setLoadError(zonesError.message)
      setZones([])
      setCouriers([])
      setLoading(false)
      return
    }

    const orgBySeller = new Map<string, string | null>()
    for (const row of (sellersData || []) as { id: string; organization_name: string | null }[]) {
      orgBySeller.set(row.id, row.organization_name)
    }

    const courierByZone = new Map<string, string>()
    for (const row of (czData || []) as { zone_id: string; courier_id: string }[]) {
      courierByZone.set(row.zone_id, row.courier_id)
    }

    const rows = ((zonesData || []) as any[]).map((z) => ({
      ...z,
      organization_name: orgBySeller.get(z.seller_id) ?? null,
      courier_id: courierByZone.get(z.id) || null,
    })) as ZoneRow[]

    setZones(rows)
    setCouriers((couriersData || []) as CourierOption[])
    setLoading(false)
  }

  useEffect(() => {
    loadAll()
  }, [])

  async function saveDisplayNumber(zoneId: string) {
    const raw = numberDrafts[zoneId]
    if (raw === undefined) return
    const value = raw.trim() === '' ? null : Number(raw)
    if (value !== null && (!Number.isFinite(value) || value <= 0)) {
      alert('Номер зоны должен быть положительным числом')
      return
    }
    setSavingId(zoneId)
    const { error } = await supabase.from('zones').update({ display_number: value }).eq('id', zoneId)
    setSavingId(null)
    if (error) {
      console.error(error)
      alert(error.code === '23505' ? 'Этот номер уже занят другой зоной' : 'Ошибка сохранения: ' + error.message)
      return
    }
    setZones((prev) => prev.map((z) => (z.id === zoneId ? { ...z, display_number: value } : z)))
    setNumberDrafts((prev) => {
      const next = { ...prev }
      delete next[zoneId]
      return next
    })
  }

  async function assignCourier(zoneId: string, courierId: string) {
    setSavingId(zoneId)
    // Unique-индекс на courier_zones.zone_id — одна зона = один курьер,
    // поэтому сначала снимаем старую привязку, потом ставим новую.
    const { error: delError } = await supabase.from('courier_zones').delete().eq('zone_id', zoneId)
    if (delError) {
      console.error(delError)
      setSavingId(null)
      alert('Ошибка отвязки курьера: ' + delError.message)
      return
    }
    if (courierId) {
      const { error: insError } = await supabase.from('courier_zones').insert({ zone_id: zoneId, courier_id: courierId })
      if (insError) {
        console.error(insError)
        setSavingId(null)
        alert('Ошибка назначения курьера: ' + insError.message)
        return
      }
    }
    setSavingId(null)
    setZones((prev) => prev.map((z) => (z.id === zoneId ? { ...z, courier_id: courierId || null } : z)))
  }

  const mapZones: MapZone[] = zones.map((z) => ({
    id: z.id,
    name: `${z.display_number != null ? `#${z.display_number} ` : ''}${z.name}`,
    color: z.color,
    coordinates: z.coordinates as any,
  }))

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-4 md:px-8 py-5">
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Зоны доставки</h1>
        <p className="text-sm text-gray-400 mt-0.5">Зоны всех продавцов — номера для накладных и привязка курьеров</p>
      </header>

      <main className="px-4 md:px-8 py-6 max-w-7xl mx-auto space-y-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-2 shadow-sm">
          <MapGL points={[]} zones={mapZones} height="360px" />
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400 text-sm">Загрузка...</div>
        ) : loadError ? (
          <div className="text-center py-20 text-red-500 text-sm">Ошибка загрузки зон: {loadError}</div>
        ) : zones.length === 0 ? (
          <div className="text-center py-20 text-gray-400 text-sm">Зоны не найдены</div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Зона</th>
                    <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Продавец</th>
                    <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">№</th>
                    <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Курьер</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {zones.map((z) => (
                    <tr key={z.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-2 font-bold text-gray-900">
                          <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: z.color }} />
                          {z.name}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-gray-600">{z.organization_name || '—'}</td>
                      <td className="px-5 py-4">
                        <input
                          type="number"
                          min={1}
                          value={numberDrafts[z.id] ?? (z.display_number ?? '')}
                          onChange={(e) => setNumberDrafts((prev) => ({ ...prev, [z.id]: e.target.value }))}
                          onBlur={() => saveDisplayNumber(z.id)}
                          disabled={savingId === z.id}
                          className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                        />
                      </td>
                      <td className="px-5 py-4">
                        <select
                          value={z.courier_id || ''}
                          onChange={(e) => assignCourier(z.id, e.target.value)}
                          disabled={savingId === z.id}
                          className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-400"
                        >
                          <option value="">Не назначен</option>
                          {couriers.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.full_name}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
