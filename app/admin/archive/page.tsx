'use client'

import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { Download } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const PAGE_SIZE = 50
const EXPORT_CHUNK = 1000

type StatusFilter = 'all' | 'pending' | 'in_transit' | 'delivered' | 'archived'
type PeriodPreset = 'week' | 'month' | 'year' | 'custom' | 'all'

interface SellerOption {
  id: string
  organization_name: string | null
}

interface ArchiveRow {
  id: string
  order_number: string
  client_phone: string
  client_address: string
  status: string
  price: number
  created_at: string
  sellers: { organization_name: string | null } | null
}

interface AggregateRow {
  status: string
  price: number
}

function periodBounds(preset: PeriodPreset, customFrom: string, customTo: string): { from: string | null; to: string | null } {
  const now = new Date()
  if (preset === 'week') return { from: new Date(now.getTime() - 7 * 86400000).toISOString(), to: null }
  if (preset === 'month') {
    const d = new Date(now)
    d.setMonth(d.getMonth() - 1)
    return { from: d.toISOString(), to: null }
  }
  if (preset === 'year') {
    const d = new Date(now)
    d.setFullYear(d.getFullYear() - 1)
    return { from: d.toISOString(), to: null }
  }
  if (preset === 'custom') {
    const from = customFrom ? new Date(customFrom).toISOString() : null
    const to = customTo ? new Date(new Date(customTo).getTime() + 86400000 - 1).toISOString() : null
    return { from, to }
  }
  return { from: null, to: null }
}

function applyFilters<T>(query: any, status: StatusFilter, sellerId: string, from: string | null, to: string | null): T {
  let q = query
  if (status !== 'all') q = q.eq('status', status)
  if (sellerId) q = q.eq('seller_id', sellerId)
  if (from) q = q.gte('created_at', from)
  if (to) q = q.lte('created_at', to)
  return q
}

export default function AdminArchivePage() {
  const [sellers, setSellers] = useState<SellerOption[]>([])
  const [status, setStatus] = useState<StatusFilter>('all')
  const [sellerId, setSellerId] = useState('')
  const [preset, setPreset] = useState<PeriodPreset>('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const [rows, setRows] = useState<ArchiveRow[]>([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [totalCount, setTotalCount] = useState(0)
  const [deliveredCount, setDeliveredCount] = useState(0)
  const [totalSum, setTotalSum] = useState(0)
  const [aggLoading, setAggLoading] = useState(true)

  const [exporting, setExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)

  const { from, to } = useMemo(() => periodBounds(preset, customFrom, customTo), [preset, customFrom, customTo])

  useEffect(() => {
    supabase
      .from('sellers')
      .select('id, organization_name')
      .order('organization_name')
      .then(({ data, error }) => {
        if (error) console.error(error)
        setSellers((data || []) as SellerOption[])
      })
  }, [])

  async function loadPage(pageIndex: number) {
    setLoading(true)
    const fromIdx = pageIndex * PAGE_SIZE
    const toIdx = fromIdx + PAGE_SIZE - 1
    let query = supabase
      .from('orders')
      .select('id, order_number, client_phone, client_address, status, price, created_at, sellers(organization_name)')
      .order('created_at', { ascending: false })
      .range(fromIdx, toIdx)
    query = applyFilters(query, status, sellerId, from, to)
    const { data, error } = await query
    if (error) {
      console.error(error)
      setLoadError(error.message)
      setRows([])
      setHasMore(false)
      setLoading(false)
      return
    }
    setLoadError(null)
    const result = (data || []) as unknown as ArchiveRow[]
    setRows(result)
    setHasMore(result.length === PAGE_SIZE)
    setPage(pageIndex)
    setLoading(false)
  }

  async function loadAggregates() {
    setAggLoading(true)
    let countQuery = supabase.from('orders').select('id', { count: 'exact', head: true })
    countQuery = applyFilters(countQuery, status, sellerId, from, to)
    const { count } = await countQuery

    // Сумма/доставлено считаются по price+status (не все колонки), но без
    // SQL-агрегата PostgREST это всё равно проход по всем совпадающим строкам —
    // поэтому чанками по EXPORT_CHUNK, как и сам экспорт, а не одним запросом.
    let deliveredSum = 0
    let priceSum = 0
    let offset = 0
    while (true) {
      let aggQuery = supabase
        .from('orders')
        .select('price, status')
        .range(offset, offset + EXPORT_CHUNK - 1)
      aggQuery = applyFilters(aggQuery, status, sellerId, from, to)
      const { data: aggData, error: aggError } = await aggQuery
      if (aggError) {
        console.error(aggError)
        break
      }
      const chunk = (aggData || []) as AggregateRow[]
      deliveredSum += chunk.filter((r) => r.status === 'delivered').length
      priceSum += chunk.reduce((sum, r) => sum + (r.price || 0), 0)
      if (chunk.length < EXPORT_CHUNK) break
      offset += EXPORT_CHUNK
    }

    setTotalCount(count ?? 0)
    setDeliveredCount(deliveredSum)
    setTotalSum(priceSum)
    setAggLoading(false)
  }

  useEffect(() => {
    loadPage(0)
    loadAggregates()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, sellerId, from, to])

  async function exportExcel() {
    setExporting(true)
    setExportProgress(0)
    const allRows: any[] = []
    let offset = 0
    // Чанками по EXPORT_CHUNK, чтобы не тянуть весь архив одним запросом.
    while (true) {
      let query = supabase
        .from('orders')
        .select('order_number, status, client_phone, client_address, price, created_at, sellers(organization_name)')
        .order('created_at', { ascending: false })
        .range(offset, offset + EXPORT_CHUNK - 1)
      query = applyFilters(query, status, sellerId, from, to)
      const { data, error } = await query
      if (error) {
        console.error(error)
        break
      }
      const chunk = data || []
      allRows.push(...chunk)
      setExportProgress(allRows.length)
      if (chunk.length < EXPORT_CHUNK) break
      offset += EXPORT_CHUNK
    }

    const sheetRows = allRows.map((o: any) => ({
      'Номер заказа': o.order_number,
      'Продавец': o.sellers?.organization_name || '—',
      'Статус': o.status,
      'Телефон': o.client_phone,
      'Адрес': o.client_address,
      'Цена': o.price,
      'Дата': o.created_at,
    }))
    const ws = XLSX.utils.json_to_sheet(sheetRows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Архив')
    XLSX.writeFile(wb, 'admin_arhiv_zakazov.xlsx')

    setExporting(false)
    setExportProgress(0)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-4 md:px-8 py-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Архив</h1>
          <p className="text-sm text-gray-400 mt-0.5">Все заказы всех продавцов за всё время</p>
        </div>
        <button
          onClick={exportExcel}
          disabled={exporting}
          className="flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
        >
          <Download size={16} />
          {exporting ? `Экспорт... ${exportProgress}` : 'Экспорт в Excel'}
        </button>
      </header>

      <main className="px-4 md:px-8 py-6 max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 shadow-sm flex flex-wrap gap-3 items-end">
          <div className="flex gap-2">
            {(['all', 'week', 'month', 'year', 'custom'] as PeriodPreset[]).map((p) => (
              <button
                key={p}
                onClick={() => setPreset(p)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  preset === p ? 'bg-red-600 text-white' : 'border border-gray-200 text-gray-500 hover:bg-gray-100 bg-white'
                }`}
              >
                {p === 'all' ? 'Всё время' : p === 'week' ? 'Неделя' : p === 'month' ? 'Месяц' : p === 'year' ? 'Год' : 'Период'}
              </button>
            ))}
          </div>
          {preset === 'custom' && (
            <>
              <label className="text-xs text-gray-500">
                От
                <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="block border rounded-lg px-2 py-1.5 mt-0.5" />
              </label>
              <label className="text-xs text-gray-500">
                До
                <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="block border rounded-lg px-2 py-1.5 mt-0.5" />
              </label>
            </>
          )}
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-400"
          >
            <option value="all">Все статусы</option>
            <option value="pending">Ожидают</option>
            <option value="in_transit">В пути</option>
            <option value="delivered">Доставлено</option>
            <option value="archived">Архив</option>
          </select>
          <select
            value={sellerId}
            onChange={(e) => setSellerId(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-400"
          >
            <option value="">Все продавцы</option>
            {sellers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.organization_name || s.id}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <p className="text-sm text-gray-500 font-medium">Всего заказов</p>
            <p className="text-3xl font-black text-gray-900 mt-1">{aggLoading ? '—' : totalCount}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <p className="text-sm text-gray-500 font-medium">Доставлено</p>
            <p className="text-3xl font-black text-green-600 mt-1">{aggLoading ? '—' : deliveredCount}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <p className="text-sm text-gray-500 font-medium">Сумма</p>
            <p className="text-3xl font-black text-gray-900 mt-1">{aggLoading ? '—' : `${totalSum.toLocaleString('ru-RU')} ₸`}</p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400 text-sm">Загрузка...</div>
        ) : loadError ? (
          <div className="text-center py-20 text-red-500 text-sm">Ошибка загрузки архива: {loadError}</div>
        ) : rows.length === 0 ? (
          <div className="text-center py-20 text-gray-400 text-sm">Заказы не найдены</div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-4 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Заказ</th>
                    <th className="px-4 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Продавец</th>
                    <th className="px-4 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Статус</th>
                    <th className="px-4 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Телефон</th>
                    <th className="px-4 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Цена</th>
                    <th className="px-4 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Дата</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rows.map((o) => (
                    <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-4 font-mono font-bold text-gray-900">{o.order_number}</td>
                      <td className="px-4 py-4 text-gray-600">{o.sellers?.organization_name || '—'}</td>
                      <td className="px-4 py-4 text-gray-600">{o.status}</td>
                      <td className="px-4 py-4 text-gray-600">{o.client_phone}</td>
                      <td className="px-4 py-4 font-bold text-gray-900">{(o.price || 0).toLocaleString('ru-RU')} ₸</td>
                      <td className="px-4 py-4 text-gray-400 text-xs">{new Date(o.created_at).toLocaleDateString('ru-RU')}</td>
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
