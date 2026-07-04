'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import * as XLSX from 'xlsx'
import { FileSpreadsheet, Search, Calendar } from 'lucide-react'
import { useLang } from '@/lib/i18n'

interface Order {
  id: string
  order_number: string
  client_phone: string
  client_address: string
  status: string
  price: number
  courier_name: string | null
  created_at: string
}

export default function ArchivePage() {
  const { t } = useLang()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterDate, setFilterDate] = useState('')

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('status', 'delivered')
        .order('created_at', { ascending: false })
      if (error) console.error(error.message)
      else setOrders(data as Order[])
      setLoading(false)
    }
    fetchOrders()
  }, [])

  const filtered = orders.filter((o) => {
    const matchDate = !filterDate || o.created_at.startsWith(filterDate)
    const matchSearch =
      o.order_number.toLowerCase().includes(search.toLowerCase()) ||
      o.client_phone.includes(search) ||
      o.client_address.toLowerCase().includes(search.toLowerCase())
    return matchDate && matchSearch
  })

  // Экспорт в Excel
  const exportToExcel = () => {
    const data = filtered.map(o => ({
      'Номер заказа': o.order_number,
      'Телефон': o.client_phone,
      'Адрес': o.client_address,
      'Стоимость (₸)': o.price,
      'Курьер': o.courier_name || '—',
      'Дата': new Date(o.created_at).toLocaleDateString('ru-RU'),
      'Статус': 'Доставлено',
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Архив')
    XLSX.writeFile(wb, `kanexpress-archive-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-8 py-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">{t('archive')}</h1>
          <p className="text-sm text-gray-400 mt-0.5">{t('delivered')}</p>
        </div>
        <button
          onClick={exportToExcel}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-green-100"
        >
          <FileSpreadsheet size={16} />
          {t('exportExcel')}
        </button>
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
          <div className="text-center py-20 text-gray-400 text-sm">{t('notFound')}</div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{t('orderNum')}</th>
                  <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{t('phone')}</th>
                  <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{t('address')}</th>
                  <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{t('price')}</th>
                  <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{t('courier')}</th>
                  <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{t('date')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4 font-mono font-bold text-gray-900">{order.order_number}</td>
                    <td className="px-5 py-4 text-gray-600">{order.client_phone}</td>
                    <td className="px-5 py-4 text-gray-500 max-w-[180px] truncate">{order.client_address}</td>
                    <td className="px-5 py-4 font-bold text-gray-900">{order.price?.toLocaleString('ru-RU')} ₸</td>
                    <td className="px-5 py-4 text-gray-600">{order.courier_name || '—'}</td>
                    <td className="px-5 py-4 text-gray-400 text-xs">{new Date(order.created_at).toLocaleDateString('ru-RU')}</td>
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