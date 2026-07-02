'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { Package, Truck, CheckCircle, Search, Calendar, Download } from 'lucide-react'
import { useLang } from '@/lib/i18n'

type OrderStatus = 'pending' | 'in_transit' | 'delivered'

interface Order {
  id: string
  order_number: string
  client_phone: string
  client_address: string
  status: OrderStatus
  price: number
  courier_name: string | null
  comment: string | null
  created_at: string
}

const STATUS_STYLE: Record<OrderStatus, { color: string; bg: string }> = {
  pending:    { color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  in_transit: { color: 'text-blue-700',  bg: 'bg-blue-50 border-blue-200' },
  delivered:  { color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
}

export default function SellerDashboard() {
  const { t } = useLang()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<OrderStatus | 'all'>('all')
  const [filterDate, setFilterDate] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

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

  const toggleOne = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map(o => o.id)))
  }

  // Массовое изменение статуса
  const massSetStatus = async (status: OrderStatus) => {
    if (selected.size === 0) return
    await supabase.from('orders').update({ status }).in('id', Array.from(selected))
    setSelected(new Set())
  }

  const statCounts: Record<OrderStatus, number> = {
    pending: orders.filter(o => o.status === 'pending').length,
    in_transit: orders.filter(o => o.status === 'in_transit').length,
    delivered: orders.filter(o => o.status === 'delivered').length,
  }

  const STAT_CARDS = [
    { key: 'pending' as OrderStatus,    icon: Package,     color: 'text-amber-600', border: 'border-amber-100', iconBg: 'bg-amber-50' },
    { key: 'in_transit' as OrderStatus, icon: Truck,       color: 'text-blue-600',  border: 'border-blue-100',  iconBg: 'bg-blue-50' },
    { key: 'delivered' as OrderStatus,  icon: CheckCircle, color: 'text-green-600', border: 'border-green-100', iconBg: 'bg-green-50' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-8 py-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">{t('dashboard')}</h1>
          <p className="text-sm text-gray-400 mt-0.5">{t('dashboardSub')}</p>
        </div>
        <Link href="/invoices">
          <button className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-red-100">
            <Download size={16} />
            {t('downloadInvoices')}
          </button>
        </Link>
      </header>

      <main className="px-8 py-6 max-w-7xl mx-auto">
        {/* Карточки */}
        <div className="grid grid-cols-3 gap-5 mb-6">
          {STAT_CARDS.map(({ key, icon: Icon, color, border, iconBg }) => (
            <div
              key={key}
              onClick={() => setFilterStatus(filterStatus === key ? 'all' : key)}
              className={`bg-white rounded-2xl border-2 ${border} p-6 cursor-pointer transition-all hover:shadow-md ${filterStatus === key ? 'ring-2 ring-red-400' : ''}`}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold text-gray-500">{t(key)}</span>
                <div className={`${iconBg} p-2 rounded-xl`}>
                  <Icon size={20} className={color} />
                </div>
              </div>
              <p className={`text-5xl font-black ${color}`}>{statCounts[key]}</p>
            </div>
          ))}
        </div>

        {/* Панель массовых действий — появляется когда есть выбранные */}
        {selected.size > 0 && (
          <div className="bg-red-600 text-white rounded-2xl p-4 mb-4 flex items-center justify-between shadow-lg shadow-red-200">
            <span className="text-sm font-semibold">{t('massActions')}: {selected.size}</span>
            <div className="flex gap-2">
              <button onClick={() => massSetStatus('in_transit')} className="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all">
                → {t('in_transit')}
              </button>
              <button onClick={() => massSetStatus('delivered')} className="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all">
                → {t('delivered')}
              </button>
              <Link href="/invoices">
                <button className="bg-white text-red-600 px-3 py-1.5 rounded-lg text-xs font-bold transition-all">
                  {t('downloadSelected')}
                </button>
              </Link>
            </div>
          </div>
        )}

        {/* Фильтры */}
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
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as OrderStatus | 'all')}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-400"
          >
            <option value="all">{t('allStatuses')}</option>
            <option value="pending">{t('pending')}</option>
            <option value="in_transit">{t('in_transit')}</option>
            <option value="delivered">{t('delivered')}</option>
          </select>
          <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2 bg-gray-50">
            <Calendar size={16} className="text-gray-400" />
            <input
              type="date"
              value={filterDate}
              onChange={e => setFilterDate(e.target.value)}
              className="bg-transparent text-sm text-gray-700 focus:outline-none"
            />
          </div>
          {(filterStatus !== 'all' || filterDate || search) && (
            <button
              onClick={() => { setFilterStatus('all'); setFilterDate(''); setSearch('') }}
              className="text-sm text-red-500 hover:text-red-700 font-semibold px-2"
            >
              {t('reset')}
            </button>
          )}
        </div>

        {/* Таблица */}
        {loading ? (
          <div className="text-center py-20 text-gray-400 text-sm">{t('loading')}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400 text-sm">{t('notFound')}</div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-4">
                    <input
                      type="checkbox"
                      checked={filtered.length > 0 && selected.size === filtered.length}
                      onChange={toggleAll}
                      className="w-4 h-4 accent-red-600 cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{t('orderNum')}</th>
                  <th className="px-4 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{t('phone')}</th>
                  <th className="px-4 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{t('address')}</th>
                  <th className="px-4 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{t('price')}</th>
                  <th className="px-4 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{t('courier')}</th>
                  <th className="px-4 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{t('status')}</th>
                  <th className="px-4 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{t('date')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((order) => (
                  <tr key={order.id} className={`hover:bg-gray-50 transition-colors ${selected.has(order.id) ? 'bg-red-50' : ''}`}>
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selected.has(order.id)}
                        onChange={() => toggleOne(order.id)}
                        className="w-4 h-4 accent-red-600 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-4 font-mono font-bold text-gray-900">{order.order_number}</td>
                    <td className="px-4 py-4 text-gray-600">{order.client_phone}</td>
                    <td className="px-4 py-4 text-gray-500 max-w-[180px] truncate">{order.client_address}</td>
                    <td className="px-4 py-4 font-bold text-gray-900">{order.price?.toLocaleString('ru-RU')} ₸</td>
                    <td className="px-4 py-4 text-gray-600">{order.courier_name || '—'}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold border ${STATUS_STYLE[order.status].bg} ${STATUS_STYLE[order.status].color}`}>
                        {t(order.status)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-gray-400 text-xs">{new Date(order.created_at).toLocaleDateString('ru-RU')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-gray-400 mt-3 font-medium">
          {t('shown')} {filtered.length} {t('of')} {orders.length} {t('orders')}
        </p>
      </main>
    </div>
  )
}