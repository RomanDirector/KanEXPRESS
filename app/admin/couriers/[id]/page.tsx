'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Phone, Truck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { ACCESS_STATUS_LABEL, ACCESS_STATUS_BADGE_CLASS, type AccessStatus } from '@/lib/access-status'
import { STAGE_LABEL, type DisplayStage } from '@/lib/order-status'

interface CourierRow {
  id: string
  full_name: string
  phone: string
  car_number: string | null
  access_status: AccessStatus
  courier_zones: { zones: { name: string } | null }[]
}

type PeriodKey = 'day' | 'week' | 'month' | 'all'

interface PeriodStats {
  taken: number
  delivered: number
  cancelled: number
}

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: 'day', label: 'Сегодня' },
  { key: 'week', label: 'Неделя' },
  { key: 'month', label: 'Месяц' },
  { key: 'all', label: 'Всё время' },
]

const STAGE_KEYS: DisplayStage[] = ['not_started', 'departed', 'arrived', 'delivered', 'returned', 'cancelled']

function periodStart(key: PeriodKey): string | null {
  const now = new Date()
  if (key === 'day') return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  if (key === 'week') return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  if (key === 'month') {
    const d = new Date(now)
    d.setMonth(d.getMonth() - 1)
    return d.toISOString()
  }
  return null
}

async function countOrders(courierName: string, since: string | null, extra: (q: any) => any): Promise<number> {
  let query = supabase.from('orders').select('id', { count: 'exact', head: true }).eq('courier_name', courierName)
  if (since) query = query.gte('created_at', since)
  query = extra(query)
  const { count, error } = await query
  if (error) {
    console.error('Ошибка подсчёта заказов курьера:', error)
    return 0
  }
  return count ?? 0
}

export default function AdminCourierDetailPage() {
  const params = useParams()
  const id = params?.id as string

  const [courier, setCourier] = useState<CourierRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<Record<PeriodKey, PeriodStats> | null>(null)
  const [stageBreakdown, setStageBreakdown] = useState<Record<DisplayStage, number> | null>(null)

  useEffect(() => {
    if (!id) return
    async function load() {
      setLoading(true)
      const { data: courierData, error } = await supabase
        .from('couriers')
        .select('id, full_name, phone, car_number, access_status, courier_zones(zones(name))')
        .eq('id', id)
        .maybeSingle()
      if (error || !courierData) {
        console.error(error)
        setLoading(false)
        return
      }
      const c = courierData as unknown as CourierRow
      setCourier(c)

      const periodResults = await Promise.all(
        PERIODS.map(async ({ key }) => {
          const since = periodStart(key)
          const [taken, delivered, cancelled] = await Promise.all([
            countOrders(c.full_name, since, (q) => q.or('status.eq.in_transit,status.eq.delivered,courier_stage.eq.cancelled')),
            countOrders(c.full_name, since, (q) => q.eq('status', 'delivered')),
            countOrders(c.full_name, since, (q) => q.eq('courier_stage', 'cancelled')),
          ])
          return [key, { taken, delivered, cancelled }] as [PeriodKey, PeriodStats]
        })
      )
      setStats(Object.fromEntries(periodResults) as Record<PeriodKey, PeriodStats>)

      const stageResults = await Promise.all(
        STAGE_KEYS.map(async (stage) => {
          const count = await countOrders(c.full_name, null, (q) => q.eq('courier_stage', stage))
          return [stage, count] as [DisplayStage, number]
        })
      )
      setStageBreakdown(Object.fromEntries(stageResults) as Record<DisplayStage, number>)

      setLoading(false)
    }
    load()
  }, [id])

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-4 md:px-8 py-5">
        <Link href="/admin/couriers" className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-800 mb-2">
          <ArrowLeft size={16} />
          Назад
        </Link>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">{loading ? 'Загрузка...' : courier?.full_name || 'Курьер не найден'}</h1>
        {courier && (
          <div className="flex flex-wrap items-center gap-3 mt-2">
            <span className="flex items-center gap-1.5 text-sm text-gray-500">
              <Phone size={13} className="text-gray-400" />
              {courier.phone}
            </span>
            <span className="flex items-center gap-1.5 text-sm text-gray-500">
              <Truck size={13} className="text-gray-400" />
              {courier.car_number || '—'}
            </span>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${ACCESS_STATUS_BADGE_CLASS[courier.access_status]}`}>
              {ACCESS_STATUS_LABEL[courier.access_status]}
            </span>
          </div>
        )}
      </header>

      <main className="px-4 md:px-8 py-6 max-w-7xl mx-auto">
        {loading ? (
          <div className="text-center py-20 text-gray-400 text-sm">Загрузка...</div>
        ) : !courier ? (
          <div className="text-center py-20 text-gray-400 text-sm">Курьер не найден</div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
              {PERIODS.map(({ key, label }) => {
                const s = stats?.[key]
                return (
                  <div key={key} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                    <p className="text-sm font-bold text-gray-700 mb-4">{label}</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Взял в доставку</span>
                        <span className="font-bold text-gray-900">{s?.taken ?? 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Выдал</span>
                        <span className="font-bold text-green-600">{s?.delivered ?? 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Отменено</span>
                        <span className="font-bold text-red-600">{s?.cancelled ?? 0}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <p className="text-sm font-bold text-gray-700 mb-4">Разбивка по стадиям (всё время)</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                {STAGE_KEYS.map((stage) => (
                  <div key={stage} className="text-center">
                    <p className="text-2xl font-black text-gray-900">{stageBreakdown?.[stage] ?? 0}</p>
                    <p className="text-xs text-gray-400 mt-1">{STAGE_LABEL[stage]}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
