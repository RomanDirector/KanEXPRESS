'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const PAGE_SIZE = 50

type PeriodPreset = 'all' | 'week' | 'month'

interface CourierOption {
  id: string
  full_name: string
}

interface CancelledRow {
  id: string
  order_number: string
  cancel_reason: string | null
  cancelled_by: 'courier' | 'seller' | null
  cancelled_at: string | null
  courier_name: string | null
  sellers: { organization_name: string | null } | null
}

const CANCELLED_BY_LABEL: Record<string, string> = {
  courier: 'Курьером',
  seller: 'Продавцом',
}

function periodStart(preset: PeriodPreset): string | null {
  if (preset === 'all') return null
  const now = new Date()
  if (preset === 'week') return new Date(now.getTime() - 7 * 86400000).toISOString()
  const d = new Date(now)
  d.setMonth(d.getMonth() - 1)
  return d.toISOString()
}

export default function AdminCancelledPage() {
  const [couriers, setCouriers] = useState<CourierOption[]>([])
  const [courierName, setCourierName] = useState('')
  const [preset, setPreset] = useState<PeriodPreset>('all')

  const [rows, setRows] = useState<CancelledRow[]>([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('couriers')
      .select('id, full_name')
      .order('full_name')
      .then(({ data, error }) => {
        if (error) console.error(error)
        setCouriers((data || []) as CourierOption[])
      })
  }, [])

  async function loadPage(pageIndex: number) {
    setLoading(true)
    const from = pageIndex * PAGE_SIZE
    const to = from + PAGE_SIZE - 1
    let query = supabase
      .from('orders')
      .select('id, order_number, cancel_reason, cancelled_by, cancelled_at, courier_name, sellers(organization_name)')
      .eq('courier_stage', 'cancelled')
      .order('cancelled_at', { ascending: false })
      .range(from, to)
    const since = periodStart(preset)
    if (since) query = query.gte('cancelled_at', since)
    if (courierName) query = query.eq('courier_name', courierName)

    const { data, error } = await query
    if (error) console.error(error)
    const result = (data || []) as unknown as CancelledRow[]
    setRows(result)
    setHasMore(result.length === PAGE_SIZE)
    setPage(pageIndex)
    setLoading(false)
  }

  useEffect(() => {
    loadPage(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, courierName])

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-4 md:px-8 py-5">
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Отменённые заказы</h1>
        <p className="text-sm text-gray-400 mt-0.5">Все продавцы</p>
      </header>

      <main className="px-4 md:px-8 py-6 max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 shadow-sm flex flex-wrap gap-3 items-center">
          <div className="flex gap-2">
            {(['all', 'week', 'month'] as PeriodPreset[]).map((p) => (
              <button
                key={p}
                onClick={() => setPreset(p)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  preset === p ? 'bg-red-600 text-white' : 'border border-gray-200 text-gray-500 hover:bg-gray-100 bg-white'
                }`}
              >
                {p === 'all' ? 'Всё время' : p === 'week' ? 'Неделя' : 'Месяц'}
              </button>
            ))}
          </div>
          <select
            value={courierName}
            onChange={(e) => setCourierName(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-400"
          >
            <option value="">Все курьеры</option>
            {couriers.map((c) => (
              <option key={c.id} value={c.full_name}>
                {c.full_name}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400 text-sm">Загрузка...</div>
        ) : rows.length === 0 ? (
          <div className="text-center py-20 text-gray-400 text-sm">Отменённых заказов не найдено</div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Заказ</th>
                    <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Продавец</th>
                    <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Курьер</th>
                    <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Причина</th>
                    <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Кем отменён</th>
                    <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Дата</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rows.map((o) => (
                    <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-4 font-mono font-bold text-gray-900">{o.order_number}</td>
                      <td className="px-5 py-4 text-gray-600">{o.sellers?.organization_name || '—'}</td>
                      <td className="px-5 py-4 text-gray-600">{o.courier_name || '—'}</td>
                      <td className="px-5 py-4 text-gray-600 max-w-[220px] truncate">{o.cancel_reason || '—'}</td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border border-red-200 bg-red-50 text-red-700">
                          {(o.cancelled_by && CANCELLED_BY_LABEL[o.cancelled_by]) || '—'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-gray-400 text-xs">
                        {o.cancelled_at ? new Date(o.cancelled_at).toLocaleString('ru-RU') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => loadPage(Math.max(0, page - 1))}
            disabled={page === 0 || loading}
            className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-all"
          >
            Назад
          </button>
          <span className="text-xs text-gray-400">Страница {page + 1}</span>
          <button
            onClick={() => loadPage(page + 1)}
            disabled={!hasMore || loading}
            className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-all"
          >
            Вперёд
          </button>
        </div>
      </main>
    </div>
  )
}
