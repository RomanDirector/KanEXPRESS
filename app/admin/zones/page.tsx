'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase'
import { assignZonesToOrders } from '@/lib/zones'
import { friendlyDbError } from '@/lib/db-errors'
import { Toast } from '@/components/Toast'
import type { MapZone } from '@/components/MapGL'
import type { OrderPoint } from '@/components/ZoneMapEditor'

const MapGL = dynamic(() => import('@/components/MapGL'), { ssr: false })
const ZoneMapEditor = dynamic(() => import('@/components/ZoneMapEditor'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-96 text-gray-400">Загрузка карты…</div>,
})

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
  zone_group_id: string
  seller_id: string
  organization_name: string | null
  courier_id: string | null
}

interface SellerOption {
  id: string
  organization_name: string | null
}

export default function AdminZonesPage() {
  const [zones, setZones] = useState<ZoneRow[]>([])
  const [couriers, setCouriers] = useState<CourierOption[]>([])
  const [sellers, setSellers] = useState<SellerOption[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [numberDrafts, setNumberDrafts] = useState<Record<string, string>>({})

  const [allOrders, setAllOrders] = useState<OrderPoint[]>([])
  const [assigning, setAssigning] = useState(false)
  const [assignResult, setAssignResult] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null)

  async function loadAll() {
    setLoading(true)
    setLoadError(null)
    const [
      { data: zonesData, error: zonesError },
      { data: sellersData, error: sellersError },
      { data: czData, error: czError },
      { data: couriersData, error: couriersError },
    ] = await Promise.all([
      supabase.from('zones').select('id, name, color, coordinates, display_number, zone_group_id, seller_id').order('name'),
      supabase.from('sellers').select('id, organization_name').order('organization_name'),
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
    for (const row of (sellersData || []) as SellerOption[]) {
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
    setSellers((sellersData || []) as SellerOption[])
    setLoading(false)
  }

  useEffect(() => {
    loadAll()
  }, [])

  // Точки заказов ВСЕХ продавцов — просто справочный слой поверх карты,
  // пока админ рисует зону, которая всё равно применяется сразу ко всем.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, client_address, lat, lng, status')
      if (error) {
        console.error(error.message)
        return
      }
      if (cancelled) return
      const points = (data || [])
        .filter((o: any) => o.lat != null && o.lng != null)
        .map((o: any) => ({
          id: o.id,
          order_number: o.order_number,
          client_address: o.client_address,
          lat: o.lat,
          lng: o.lng,
          status: o.status,
        }))
      setAllOrders(points)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Зоны теперь общие для всех продавцов — распределяем заказы по зонам
  // разом за каждого продавца, а не за одного выбранного.
  async function handleAssign() {
    setAssigning(true)
    setAssignResult(null)
    let totalAssigned = 0
    let totalUnassigned = 0
    for (const s of sellers) {
      const { assigned, unassigned } = await assignZonesToOrders(s.id)
      totalAssigned += assigned
      totalUnassigned += unassigned
    }
    setAssigning(false)
    setAssignResult(`Распределено: ${totalAssigned}, не распределено: ${totalUnassigned}`)
    loadAll()
  }

  // Номер зоны общий для всей группы (одна логическая зона = N строк zones,
  // по одной на продавца, см. ZoneMapEditor) — правим через zone_group_id,
  // тем же паттерном, что уже применяется для координат/названия полигона,
  // а не по id одной строки, иначе у разных продавцов разъедутся номера на
  // одной и той же зоне.
  async function saveDisplayNumber(zoneId: string) {
    const raw = numberDrafts[zoneId]
    if (raw === undefined) return
    const value = raw.trim() === '' ? null : Number(raw)
    if (value !== null && (!Number.isFinite(value) || value <= 0)) {
      setToast({ message: 'Номер зоны должен быть положительным числом', type: 'error' })
      return
    }
    const zone = zones.find((z) => z.id === zoneId)
    if (!zone) return
    setSavingId(zoneId)
    const { error } = await supabase
      .from('zones')
      .update({ display_number: value })
      .eq('zone_group_id', zone.zone_group_id)
    setSavingId(null)
    if (error) {
      console.error(error)
      setToast({
        message: error.code === '23505' ? 'Этот номер уже занят другой зоной' : friendlyDbError(error, 'Не удалось сохранить номер зоны'),
        type: 'error',
      })
      return
    }
    setZones((prev) => prev.map((z) => (z.zone_group_id === zone.zone_group_id ? { ...z, display_number: value } : z)))
    setNumberDrafts((prev) => {
      const next = { ...prev }
      delete next[zoneId]
      return next
    })
  }

  async function assignCourier(zoneId: string, courierId: string) {
    setSavingId(zoneId)
    const { error: delError } = await supabase.from('courier_zones').delete().eq('zone_id', zoneId)
    if (delError) {
      console.error(delError)
      setSavingId(null)
      setToast({ message: friendlyDbError(delError, 'Не удалось отвязать курьера'), type: 'error' })
      return
    }
    if (courierId) {
      const { error: insError } = await supabase.from('courier_zones').insert({ zone_id: zoneId, courier_id: courierId })
      if (insError) {
        console.error(insError)
        setSavingId(null)
        setToast({ message: friendlyDbError(insError, 'Не удалось назначить курьера'), type: 'error' })
        return
      }
    }
    setSavingId(null)
    setZones((prev) => prev.map((z) => (z.id === zoneId ? { ...z, courier_id: courierId || null } : z)))
  }

  async function deleteZone(zoneId: string) {
    if (!confirm('Удалить зону?')) return
    setSavingId(zoneId)
    const { error } = await supabase.from('zones').delete().eq('id', zoneId)
    setSavingId(null)
    if (error) {
      console.error('Ошибка удаления зоны:', error)
      setToast({ message: friendlyDbError(error, 'Не удалось удалить зону'), type: 'error' })
      return
    }
    setZones((prev) => prev.filter((z) => z.id !== zoneId))
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
                    <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {zones.map((z) => (
                    <tr
                      key={z.id}
                      className={`transition-colors ${
                        z.display_number == null ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'
                      }`}
                    >
                      <td className={`px-5 py-4 ${z.display_number == null ? 'border-l-4 border-red-400' : ''}`}>
                        <span className="inline-flex items-center gap-2 font-bold text-gray-900">
                          <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: z.color }} />
                          {z.name}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-gray-600">{z.organization_name || '—'}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={1}
                            value={numberDrafts[z.id] ?? (z.display_number ?? '')}
                            onChange={(e) => setNumberDrafts((prev) => ({ ...prev, [z.id]: e.target.value }))}
                            onBlur={() => saveDisplayNumber(z.id)}
                            disabled={savingId === z.id}
                            className={`w-20 border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 ${
                              z.display_number == null ? 'border-red-300' : 'border-gray-200'
                            }`}
                          />
                          {z.display_number == null && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200 whitespace-nowrap">
                              Без номера
                            </span>
                          )}
                        </div>
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
                      <td className="px-5 py-4">
                        <button
                          onClick={() => deleteZone(z.id)}
                          disabled={savingId === z.id}
                          className="text-xs font-semibold text-red-500 hover:text-red-700 disabled:opacity-50"
                        >
                          Удалить
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Рисование новой зоны + распределение заказов по зонам — сразу для всех продавцов */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 p-5 border-b border-gray-100">
            <div>
              <h2 className="text-sm font-bold text-gray-900">Нарисовать новую зону</h2>
              <p className="text-xs text-gray-400 mt-0.5">Зона рисуется один раз на карте и сразу применяется ко всем продавцам</p>
            </div>
            <div className="flex items-center gap-3">
              {assignResult && <span className="text-sm text-green-600 font-semibold">{assignResult}</span>}
              <button
                onClick={handleAssign}
                disabled={assigning}
                className="px-4 py-2 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 disabled:opacity-50 text-sm whitespace-nowrap"
              >
                {assigning ? 'Определяю…' : 'Определить районы заказов'}
              </button>
            </div>
          </div>
          <ZoneMapEditor orders={allOrders} />
        </div>
      </main>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
