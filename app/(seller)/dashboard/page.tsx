'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

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
  pending:    { label: 'Не отгружено', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
  in_transit: { label: 'В пути',       color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  delivered:  { label: 'Доставлено',   color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
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

      if (error) {
        console.error('Ошибка:', error.message)
      } else {
        setOrders(data as Order[])
      }
      setLoading(false)
    }

    fetchOrders()

    const channel = supabase
      .channel('orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchOrders()
      })
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
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <header className="border-b border-gray-200 dark:border-gray-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-red-600">KanEXpress</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Дашборд продавца</p>
        </div>
        <button
          onClick={() => alert('Скачивание накладных — следующий шаг!')}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          ⬇️ Скачать все накладные
        </button>
      </header>

      <main className="px-6 py-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-3 gap-4 mb-6">
          {(Object.entries(STATUS_CONFIG) as [OrderStatus, typeof STATUS_CONFIG[OrderStatus]][]).map(([key, cfg]) => (
            <div key={key} className="rounded-xl border border-gray-200 dark:border-gray-800 p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">{cfg.label}</p>
              <p className="text-3xl font-bold mt-1">
                {orders.filter(o => o.status === key).length}
              </p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 mb-4">
          <input
            type="text"
            placeholder="Поиск по номеру, телефону, адресу..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 flex-1 min-w-[200px]"
          />
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as OrderStatus | 'all')}
            className="border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900"
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
            className="border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900"
          />
          {(filterStatus !== 'all' || filterDate || search) && (
            <button
              onClick={() => { setFilterStatus('all'); setFilterDate(''); setSearch('') }}
              className="text-sm text-red-600 hover:underline"
            >
              Сбросить
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400">Загружаем заказы...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">Заказов не найдено</div>
        ) : (
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">№ Заказа</th>
                  <th className="px-4 py-3 font-medium">Телефон</th>
                  <th className="px-4 py-3 font-medium">Адрес</th>
                  <th className="px-4 py-3 font-medium">Дата</th>
                  <th className="px-4 py-3 font-medium">Статус</th>
                  <th className="px-4 py-3 font-medium">Накладная</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filtered.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium">{order.order_number}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{order.client_phone}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300 max-w-[200px] truncate">{order.client_address}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {new Date(order.created_at).toLocaleDateString('ru-RU')}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_CONFIG[order.status].color}`}>
                        {STATUS_CONFIG[order.status].label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => alert(`Накладная для ${order.order_number}`)}
                        className="text-red-600 hover:underline text-xs font-medium"
                      >
                        ⬇️ PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && (
          <p className="text-sm text-gray-400 mt-3">
            Показано {filtered.length} из {orders.length} заказов
          </p>
        )}
      </main>
    </div>
  )
}