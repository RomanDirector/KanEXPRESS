'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Order {
  id: string
  order_number: string
  status: string
  created_at: string
}

export default function StatsPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error:', error.message)
      } else {
        setOrders(data as Order[])
      }
      setLoading(false)
    }

    fetchOrders()
  }, [])

  const total = orders.length
  const pending = orders.filter(o => o.status === 'pending').length
  const inTransit = orders.filter(o => o.status === 'in_transit').length
  const delivered = orders.filter(o => o.status === 'delivered').length
  const deliveryRate = total > 0 ? Math.round((delivered / total) * 100) : 0

  // Группировка по датам
  const byDate: Record<string, number> = {}
  orders.forEach(o => {
    const date = new Date(o.created_at).toLocaleDateString('ru-RU')
    byDate[date] = (byDate[date] || 0) + 1
  })
  const dateEntries = Object.entries(byDate).slice(0, 7)
  const maxCount = Math.max(...dateEntries.map(([, v]) => v), 1)

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <header className="border-b border-gray-200 dark:border-gray-800 px-6 py-4">
        <h1 className="text-2xl font-bold text-red-600">KanEXpress</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Statistics</p>
      </header>

      <main className="px-6 py-6 max-w-7xl mx-auto">
        {loading ? (
          <div className="text-center py-20 text-gray-400">Loading...</div>
        ) : (
          <>
            {/* Карточки */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Orders</p>
                <p className="text-3xl font-bold mt-1">{total}</p>
              </div>
              <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4">
                <p className="text-sm text-yellow-600">Pending</p>
                <p className="text-3xl font-bold mt-1 text-yellow-600">{pending}</p>
              </div>
              <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4">
                <p className="text-sm text-blue-600">In Transit</p>
                <p className="text-3xl font-bold mt-1 text-blue-600">{inTransit}</p>
              </div>
              <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4">
                <p className="text-sm text-green-600">Delivered</p>
                <p className="text-3xl font-bold mt-1 text-green-600">{delivered}</p>
              </div>
            </div>

            {/* Процент доставки */}
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-6 mb-8">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Delivery Rate</p>
              <div className="flex items-center gap-4">
                <div className="flex-1 bg-gray-200 dark:bg-gray-800 rounded-full h-4">
                  <div
                    className="bg-red-600 h-4 rounded-full transition-all"
                    style={{ width: `${deliveryRate}%` }}
                  />
                </div>
                <span className="text-2xl font-bold text-red-600">{deliveryRate}%</span>
              </div>
            </div>

            {/* График по датам */}
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-6">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Orders by Date</p>
              {dateEntries.length === 0 ? (
                <p className="text-gray-400 text-sm">No data</p>
              ) : (
                <div className="flex items-end gap-3 h-40">
                  {dateEntries.map(([date, count]) => (
                    <div key={date} className="flex flex-col items-center flex-1">
                      <span className="text-xs text-gray-500 mb-1">{count}</span>
                      <div
                        className="w-full bg-red-600 rounded-t"
                        style={{ height: `${(count / maxCount) * 100}%` }}
                      />
                      <span className="text-xs text-gray-400 mt-1 rotate-45 origin-left">{date}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}