'use client'

import { useEffect, useState } from 'react'
import { Search, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { STAGE_LABEL, STAGE_BADGE_CLASS, getDisplayStage } from '@/lib/order-status'

const PAGE_SIZE = 20

interface OrderDetail {
  id: string
  order_number: string
  client_phone: string
  client_address: string
  status: string
  courier_stage: string | null
  courier_name: string | null
  price: number
  created_at: string
  dropped_at: string | null
  accepted_at: string | null
  cancelled_at: string | null
  cancel_reason: string | null
  seller_id: string
  sellers: { organization_name: string | null } | null
  zones: { name: string; display_number: number | null } | null
  box: { code: string; label: string } | null
}

const ORDER_DETAIL_COLUMNS =
  'id, order_number, client_phone, client_address, status, courier_stage, courier_name, price, created_at, dropped_at, accepted_at, cancelled_at, cancel_reason, seller_id, sellers(organization_name), zones(name, display_number), box:delivery_boxes(code, label)'

function fmt(value: string | null) {
  return value ? new Date(value).toLocaleString('ru-RU') : '—'
}

function OrderCard({ order }: { order: OrderDetail }) {
  const stage = getDisplayStage(order)
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h3 className="text-lg font-mono font-black text-gray-900">{order.order_number}</h3>
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${STAGE_BADGE_CLASS[stage]}`}>
          {STAGE_LABEL[stage]}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <div className="flex justify-between border-b border-gray-50 py-1.5">
          <span className="text-gray-400">Продавец</span>
          <span className="font-semibold text-gray-900">{order.sellers?.organization_name || '—'}</span>
        </div>
        <div className="flex justify-between border-b border-gray-50 py-1.5">
          <span className="text-gray-400">Курьер</span>
          <span className="font-semibold text-gray-900">{order.courier_name || '—'}</span>
        </div>
        <div className="flex justify-between border-b border-gray-50 py-1.5">
          <span className="text-gray-400">Зона</span>
          <span className="font-semibold text-gray-900">
            {order.zones ? `#${order.zones.display_number ?? '—'} ${order.zones.name}` : '—'}
          </span>
        </div>
        <div className="flex justify-between border-b border-gray-50 py-1.5">
          <span className="text-gray-400">Бокс</span>
          <span className="font-semibold text-gray-900">{order.box ? `${order.box.code} (${order.box.label})` : '—'}</span>
        </div>
        <div className="flex justify-between border-b border-gray-50 py-1.5">
          <span className="text-gray-400">Телефон</span>
          <span className="font-semibold text-gray-900">{order.client_phone}</span>
        </div>
        <div className="flex justify-between border-b border-gray-50 py-1.5">
          <span className="text-gray-400">Цена</span>
          <span className="font-semibold text-gray-900">{(order.price || 0).toLocaleString('ru-RU')} ₸</span>
        </div>
        <div className="sm:col-span-2 flex justify-between border-b border-gray-50 py-1.5">
          <span className="text-gray-400">Адрес</span>
          <span className="font-semibold text-gray-900 text-right">{order.client_address}</span>
        </div>
        <div className="flex justify-between border-b border-gray-50 py-1.5">
          <span className="text-gray-400">Создан</span>
          <span className="font-semibold text-gray-900">{fmt(order.created_at)}</span>
        </div>
        <div className="flex justify-between border-b border-gray-50 py-1.5">
          <span className="text-gray-400">Отгружен</span>
          <span className="font-semibold text-gray-900">{fmt(order.dropped_at)}</span>
        </div>
        <div className="flex justify-between border-b border-gray-50 py-1.5">
          <span className="text-gray-400">Принят курьером</span>
          <span className="font-semibold text-gray-900">{fmt(order.accepted_at)}</span>
        </div>
        <div className="flex justify-between border-b border-gray-50 py-1.5">
          <span className="text-gray-400">Отменён</span>
          <span className="font-semibold text-gray-900">{fmt(order.cancelled_at)}</span>
        </div>
        {order.cancel_reason && (
          <div className="sm:col-span-2 flex justify-between py-1.5">
            <span className="text-gray-400">Причина отмены</span>
            <span className="font-semibold text-gray-900 text-right">{order.cancel_reason}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AdminOrdersPage() {
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<OrderDetail[] | null>(null)
  const [searching, setSearching] = useState(false)

  const [orders, setOrders] = useState<OrderDetail[]>([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)

  async function loadPage(pageIndex: number) {
    setLoading(true)
    const from = pageIndex * PAGE_SIZE
    const to = from + PAGE_SIZE - 1
    const { data, error } = await supabase
      .from('orders')
      .select(ORDER_DETAIL_COLUMNS)
      .in('status', ['pending', 'in_transit'])
      .order('created_at', { ascending: false })
      .range(from, to)
    if (error) console.error(error)
    const rows = (data || []) as unknown as OrderDetail[]
    setOrders(rows)
    setHasMore(rows.length === PAGE_SIZE)
    setPage(pageIndex)
    setLoading(false)
  }

  useEffect(() => {
    loadPage(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function runSearch() {
    const q = search.trim()
    if (!q) {
      setSearchResults(null)
      return
    }
    setSearching(true)
    const { data, error } = await supabase
      .from('orders')
      .select(ORDER_DETAIL_COLUMNS)
      .ilike('order_number', `%${q}%`)
      .order('created_at', { ascending: false })
      .limit(20)
    if (error) console.error(error)
    setSearchResults((data || []) as unknown as OrderDetail[])
    setSearching(false)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-4 md:px-8 py-5">
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Отслеживание заказов</h1>
        <p className="text-sm text-gray-400 mt-0.5">Поиск по номеру заказа и список активных</p>
      </header>

      <main className="px-4 md:px-8 py-6 max-w-5xl mx-auto">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-6 shadow-sm flex gap-3">
          <div className="flex items-center gap-2 flex-1 border border-gray-200 rounded-xl px-3 py-2 bg-gray-50">
            <Search size={16} className="text-gray-400" />
            <input
              type="text"
              placeholder="Номер заказа"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runSearch()}
              className="bg-transparent text-sm w-full focus:outline-none text-gray-700 placeholder-gray-400"
            />
          </div>
          <button
            onClick={runSearch}
            disabled={searching}
            className="px-5 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-all"
          >
            {searching ? 'Поиск...' : 'Найти'}
          </button>
          {searchResults !== null && (
            <button
              onClick={() => {
                setSearch('')
                setSearchResults(null)
              }}
              className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-all"
            >
              Сброс
            </button>
          )}
        </div>

        {searchResults !== null && (
          <div className="mb-8 space-y-4">
            {searchResults.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm">Ничего не найдено</div>
            ) : (
              searchResults.map((o) => <OrderCard key={o.id} order={o} />)
            )}
          </div>
        )}

        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-700">Активные заказы</h2>
          <button
            onClick={() => loadPage(page)}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Обновить
          </button>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400 text-sm">Загрузка...</div>
        ) : orders.length === 0 ? (
          <div className="text-center py-20 text-gray-400 text-sm">Активных заказов нет</div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-4 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Заказ</th>
                    <th className="px-4 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Продавец</th>
                    <th className="px-4 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Курьер</th>
                    <th className="px-4 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Статус</th>
                    <th className="px-4 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Дата</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {orders.map((o) => {
                    const stage = getDisplayStage(o)
                    return (
                      <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-4 font-mono font-bold text-gray-900">{o.order_number}</td>
                        <td className="px-4 py-4 text-gray-600">{o.sellers?.organization_name || '—'}</td>
                        <td className="px-4 py-4 text-gray-600">{o.courier_name || '—'}</td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${STAGE_BADGE_CLASS[stage]}`}>
                            {STAGE_LABEL[stage]}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-gray-400 text-xs">{fmt(o.created_at)}</td>
                      </tr>
                    )
                  })}
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
