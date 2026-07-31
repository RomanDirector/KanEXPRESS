'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Search, Calendar, Ban } from 'lucide-react'
import { useLang } from '@/lib/i18n'

interface CancelledOrder {
  id: string
  order_number: string
  client_address: string
  cancel_reason: string | null
  cancelled_by: 'courier' | 'seller' | null
  cancelled_at: string | null
}

const CANCELLED_BY_LABEL: Record<string, string> = {
  courier: 'Курьер',
  seller: 'Продавец',
}

export default function CancelledOrdersPage() {
  const { t } = useLang()
  const [orders, setOrders] = useState<CancelledOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterDate, setFilterDate] = useState('')

  useEffect(() => {
    let cancelled = false
    let channel: ReturnType<typeof supabase.channel> | null = null

    const fetchOrders = async (sellerId: string) => {
      setLoading(true)
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, client_address, cancel_reason, cancelled_by, cancelled_at')
        .eq('seller_id', sellerId)
        .eq('courier_stage', 'cancelled')
        .order('cancelled_at', { ascending: false })
      if (error) console.error(error.message)
      else setOrders(data as CancelledOrder[])
      setLoading(false)
    }

    ;(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (cancelled || !user) return
      await fetchOrders(user.id)
      channel = supabase
        .channel('seller-cancelled-orders-realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'orders', filter: `seller_id=eq.${user.id}` },
          () => fetchOrders(user.id)
        )
        .subscribe()
    })()

    return () => {
      cancelled = true
      if (channel) supabase.removeChannel(channel)
    }
  }, [])

  const filtered = orders.filter((o) => {
    const matchDate = !filterDate || (o.cancelled_at ?? '').startsWith(filterDate)
    const matchSearch =
      o.order_number.toLowerCase().includes(search.toLowerCase()) ||
      o.client_address.toLowerCase().includes(search.toLowerCase())
    return matchDate && matchSearch
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-8 py-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">{t('cancelled')}</h1>
          <p className="text-sm text-gray-400 mt-0.5">Отменённые заказы вашего магазина</p>
        </div>
      </header>

      <main className="px-8 py-6 max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 flex flex-wrap gap-3 shadow-sm">
          <div className="flex items-center gap-2 flex-1 min-w-[200px] border border-gray-200 rounded-xl px-3 py-2 bg-gray-50">
            <Search size={16} className="text-gray-400" />
            <input
              type="text"
              placeholder={t('search')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-transparent text-sm w-full focus:outline-none text-gray-700 placeholder-gray-400"
            />
          </div>
          <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2 bg-gray-50">
            <Calendar size={16} className="text-gray-400" />
            <input
              type="date"
              value={filterDate}
              onChange={e => setFilterDate(e.target.value)}
              className="bg-transparent text-sm text-gray-700 focus:outline-none"
            />
          </div>
          {(filterDate || search) && (
            <button
              onClick={() => { setFilterDate(''); setSearch('') }}
              className="text-sm text-red-500 hover:text-red-700 font-semibold px-2"
            >
              {t('reset')}
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400 text-sm">{t('loading')}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Ban size={40} className="text-gray-200 mx-auto mb-4" />
            <p className="text-gray-400 text-sm">{t('notFound')}</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{t('orderNum')}</th>
                  <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{t('address')}</th>
                  <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Причина отмены</th>
                  <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Кем отменён</th>
                  <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Дата отмены</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4 font-mono font-bold text-gray-900">{order.order_number}</td>
                    <td className="px-5 py-4 text-gray-500 max-w-[220px] truncate">{order.client_address}</td>
                    <td className="px-5 py-4 text-gray-600 max-w-[240px] truncate">{order.cancel_reason || '—'}</td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border border-red-200 bg-red-50 text-red-700">
                        {(order.cancelled_by && CANCELLED_BY_LABEL[order.cancelled_by]) || '—'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-400 text-xs">
                      {order.cancelled_at ? new Date(order.cancelled_at).toLocaleString('ru-RU') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-gray-400 mt-3 font-medium">{t('total')}: {filtered.length}</p>
      </main>
    </div>
  )
}
