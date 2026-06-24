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
  const [period, setPeriod] = useState<'week' | 'month' | 'all'>('all')

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
  }, [])

  const filtered = orders.filter(o => {
    const date = new Date(o.created_at)
    const now = new Date()
    if (period === 'week') {
      const weekAgo = new Date()
      weekAgo.setDate(now.getDate() - 7)
      return date >= weekAgo
    }
    if (period === 'month') {
      const monthAgo = new Date()
      monthAgo.setMonth(now.getMonth() - 1)
      return date >= monthAgo
    }
    return true
  })

  const total = filtered.length
  const pending = filtered.filter(o => o.status === 'pending').length
  const inTransit = filtered.filter(o => o.status === 'in_transit').length
  const delivered = filtered.filter(o => o.status === 'delivered').length
  const deliveryRate = total > 0 ? Math.round((delivered / total) * 100) : 0

  const byDate: Record<string, number> = {}
  filtered.forEach(o => {
    const date = new Date(o.created_at).toLocaleDateString('ru-RU')
    byDate[date] = (byDate[date] || 0) + 1
  })
  const dateEntries = Object.entries(byDate).slice(0, 7)
  const maxCount = Math.max(...dateEntries.map(([, v]) => v), 1)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <h2 className="text-xl font-bold text-gray-900">Statistics</h2>
        <div className="flex gap-2">
          {(['week', 'month', 'all'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
                period === p
                  ? 'bg-red-600 text-white shadow-sm shadow-red-200'
                  : 'border border-gray-200 text-gray-500 hover:bg-gray-100 bg-white'
              }`}
            >
              {p === 'week' ? 'Week' : p === 'month' ? 'Month' : 'All time'}
            </button>
          ))}
        </div>
      </header>

      <main className="px-6 py-6 max-w-7xl mx-auto">
        {loading ? (
          <div className="text-center py-20 text-gray-400">Loading...</div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <p className="text-sm text-gray-500 font-medium">Total Orders</p>
                <p className="text-4xl font-black mt-2 text-gray-900">{total}</p>
              </div>
              <div className="bg-white rounded-2xl border border-yellow-200 p-5 shadow-sm">
                <p className="text-sm text-yellow-600 font-medium">Pending</p>
                <p className="text-4xl font-black mt-2 text-yellow-600">{pending}</p>
              </div>
              <div className="bg-white rounded-2xl border border-blue-200 p-5 shadow-sm">
                <p className="text-sm text-blue-600 font-medium">In Transit</p>
                <p className="text-4xl font-black mt-2 text-blue-600">{inTransit}</p>
              </div>
              <div className="bg-white rounded-2xl border border-green-200 p-5 shadow-sm">
                <p className="text-sm text-green-600 font-medium">Delivered</p>
                <p className="text-4xl font-black mt-2 text-green-600">{delivered}</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6 shadow-sm">
              <p className="text-sm text-gray-500 font-medium mb-3">Delivery Rate</p>
              <div className="flex items-center gap-4">
                <div className="flex-1 bg-gray-100 rounded-full h-4">
                  <div
                    className="bg-red-600 h-4 rounded-full transition-all"
                    style={{ width: `${deliveryRate}%` }}
                  />
                </div>
                <span className="text-2xl font-black text-red-600">{deliveryRate}%</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <p className="text-sm text-gray-500 font-medium mb-6">Orders by Date</p>
              {dateEntries.length === 0 ? (
                <p className="text-gray-400 text-sm">No data</p>
              ) : (
                <div className="flex items-end gap-4 h-48">
                  {dateEntries.map(([date, count]) => (
                    <div key={date} className="flex flex-col items-center flex-1 gap-1">
                      <span className="text-xs text-gray-500 font-medium">{count}</span>
                      <div
                        className="w-full bg-red-500 rounded-t min-h-[4px]"
                        style={{ height: `${(count / maxCount) * 160}px` }}
                      />
                      <span className="text-xs text-gray-400 text-center">{date}</span>
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