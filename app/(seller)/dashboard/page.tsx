'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type OrderStatus = 'pending' | 'in_transit' | 'delivered'

interface Order {
  id: string
  order_number: string
  client_phone: string
  client_address: string
  status: OrderStatus
  created_at: string
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string }> = {
  pending:    { label: 'Не отгружено', color: 'bg-yellow-100 text-yellow-700 border border-yellow-200' },
  in_transit: { label: 'В пути',       color: 'bg-blue-100 text-blue-700 border border-blue-200' },
  delivered:  { label: 'Доставлено',   color: 'bg-green-100 text-green-700 border border-green-200' },
}

export default function SellerDashboard() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<OrderStatus | 'all'>('all')
  const [filterDate, setFilterDate] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) console.error(error.message)
      else setOrders(data as Order[])
      setLoading(false)
    }
    fetchOrders()
    const channel = supabase
      .channel('orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const filtered = orders.filter((o) => {
    const matchStatus = filterStatus === 'all' || o.status === filterStatus
    const matchDate = !filterDate || o.created_at.startsWith(filterDate)
    const matchSearch =
      o.order_number.toLowerCase().includes(search.toLowerCase()) ||
      o.client_phone.includes(search) ||
      o.client_address.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchDate && matchSearch
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <h2 className="text-xl font-bold text-gray-900">Dashboard</h2>
        <Link href="/invoices">
          <button className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm shadow-red-200">
            ⬇️ Скачать все накладные
          </button>
        </Link>
      </header>

      <main className="px-6 py-6 max-w-7xl mx-auto">
        {/* Карточки статистики */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {(Object.entries(STATUS_CONFIG) as [OrderStatus, typeof STATUS_CONFIG[OrderStatus]][]).map(([key, cfg]) => (
            <div key={key} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <p className="text-sm text-gray-500 font-medium">{cfg.label}</p>
              <p className="text-4xl font-black mt-2 text-gray-900">
                {orders.filter(o => o.status === key).length}
              </p>
            </div>
          ))}
        </div>

        {/* Фильтры */}
        <div className="flex flex-wrap gap-3 mb-4">
          <input
            type="text"
            placeholder="Поиск по номеру, телефону, адресу..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white flex-1 min-w-[200px] shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as OrderStatus | 'all')}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="all">Все статусы</option>
            <option value="pending">Не отгружено</option>
            <option value="in_transit">В пути</option>
            <option value="delivered">Доставлено</option>
          </select>
          <input
            type="date"
            value={filterDate}
            onChange={e => setFilterDate(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          {(filterStatus !== 'all' || filterDate || search) && (
            <button
              onClick={() => { setFilterStatus('all'); setFilterDate(''); setSearch('') }}
              className="text-sm text-red-600 hover:underline font-medium"
            >
              Сбросить
            </button>
          )}
        </div>

        {/* Таблица */}
        {loading ? (
          <div className="text-center py-20 text-gray-400">Загружаем заказы...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">Заказов не найдено</div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-left border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 font-semibold">№ Заказа</th>
                  <th className="px-4 py-3 font-semibold">Телефон</th>
                  <th className="px-4 py-3 font-semibold">Адрес</th>
                  <th className="px-4 py-3 font-semibold">Дата</th>
                  <th className="px-4 py-3 font-semibold">Статус</th>
                  <th className="px-4 py-3 font-semibold">Накладная</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-gray-900">{order.order_number}</td>
                    <td className="px-4 py-3 text-gray-600">{order.client_phone}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">{order.client_address}</td>
                    <td className="px-4 py-3 text-gray-400">{new Date(order.created_at).toLocaleDateString('ru-RU')}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${STATUS_CONFIG[order.status].color}`}>
                        {STATUS_CONFIG[order.status].label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link href="/invoices">
                        <button className="text-red-600 hover:text-red-700 text-xs font-semibold hover:underline">
                          ⬇️ PDF
                        </button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && (
          <p className="text-sm text-gray-400 mt-3">Показано {filtered.length} из {orders.length} заказов</p>
        )}
      </main>
    </div>
  )
}