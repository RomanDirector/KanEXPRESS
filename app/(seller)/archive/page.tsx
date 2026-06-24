'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Order {
  id: string
  order_number: string
  client_phone: string
  client_address: string
  status: string
  created_at: string
}

export default function ArchivePage() {
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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <h2 className="text-xl font-bold text-gray-900">Archive</h2>
        <p className="text-sm text-gray-400">Delivered orders only</p>
      </header>

      <main className="px-6 py-6 max-w-7xl mx-auto">
        <div className="flex flex-wrap gap-3 mb-4">
          <input
            type="text"
            placeholder="Search by order, phone, address..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white flex-1 min-w-[200px] shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          <input
            type="date"
            value={filterDate}
            onChange={e => setFilterDate(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          {(filterDate || search) && (
            <button
              onClick={() => { setFilterDate(''); setSearch('') }}
              className="text-sm text-red-600 hover:underline font-medium"
            >
              Reset
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400">Loading archive...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">No archived orders found</div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-left border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 font-semibold">Order #</th>
                  <th className="px-4 py-3 font-semibold">Phone</th>
                  <th className="px-4 py-3 font-semibold">Address</th>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
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
                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
                        Delivered
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-sm text-gray-400 mt-3">Archived orders: {filtered.length}</p>
      </main>
    </div>
  )
}