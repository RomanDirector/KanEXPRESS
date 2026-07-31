'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { TrendingUp, ShoppingBag, CheckCircle, BarChart3, RotateCcw, Ban } from 'lucide-react'
import { useLang } from '@/lib/i18n'

type CourierStage = 'not_started' | 'departed' | 'arrived' | 'delivered' | 'returned' | 'cancelled'

interface Order {
  id: string
  order_number: string
  status: string
  courier_stage: CourierStage | null
  price: number
  courier_name: string | null
  created_at: string
}

export default function StatsPage() {
  const { t } = useLang()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'week' | 'month' | 'all'>('all')

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true)
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, status, courier_stage, price, courier_name, created_at')
        .eq('seller_id', user.id)
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
  const delivered = filtered.filter(o => o.status === 'delivered').length
  const pending = filtered.filter(o => o.status === 'pending').length
  const inTransit = filtered.filter(o => o.status === 'in_transit').length
  const returned = filtered.filter(o => o.courier_stage === 'returned').length
  const cancelled = filtered.filter(o => o.courier_stage === 'cancelled').length
  const deliveryRate = total > 0 ? Math.round((delivered / total) * 100) : 0
  const totalRevenue = filtered.reduce((sum, o) => sum + (o.price || 0), 0)
  const avgCheck = total > 0 ? Math.round(totalRevenue / total) : 0

  // Заказы по датам для графика
  const byDate: Record<string, { orders: number; revenue: number }> = {}
  filtered.forEach(o => {
    const date = new Date(o.created_at).toLocaleDateString('ru-RU')
    if (!byDate[date]) byDate[date] = { orders: 0, revenue: 0 }
    byDate[date].orders += 1
    byDate[date].revenue += o.price || 0
  })
  const dateEntries = Object.entries(byDate).slice(-7)
  const maxOrders = Math.max(...dateEntries.map(([, v]) => v.orders), 1)
  const maxRevenue = Math.max(...dateEntries.map(([, v]) => v.revenue), 1)

  // Выручка по курьерам
  const byCourier: Record<string, number> = {}
  filtered.forEach(o => {
    const name = o.courier_name || 'Не назначен'
    byCourier[name] = (byCourier[name] || 0) + (o.price || 0)
  })
  const courierEntries = Object.entries(byCourier).sort((a, b) => b[1] - a[1])
  const maxCourierRevenue = Math.max(...courierEntries.map(([, v]) => v), 1)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-8 py-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">{t('stats')} & {t('finance')}</h1>
          <p className="text-sm text-gray-400 mt-0.5">{t('financeSub')}</p>
        </div>
        <div className="flex gap-2">
          {(['week', 'month', 'all'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                period === p
                  ? 'bg-red-600 text-white shadow-sm shadow-red-200'
                  : 'border border-gray-200 text-gray-500 hover:bg-gray-100 bg-white'
              }`}
            >
              {p === 'week' ? t('week') : p === 'month' ? t('month') : t('allTime')}
            </button>
          ))}
        </div>
      </header>

      <main className="px-8 py-6 max-w-7xl mx-auto">
        {loading ? (
          <div className="text-center py-20 text-gray-400 text-sm">{t('loading')}</div>
        ) : (
          <>
            {/* Финансовые карточки */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5 mb-6">
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-gray-500">{t('totalRevenue')}</p>
                  <div className="bg-red-50 p-2 rounded-xl">
                    <TrendingUp size={18} className="text-red-600" />
                  </div>
                </div>
                <p className="text-3xl font-black text-gray-900">{totalRevenue.toLocaleString('ru-RU')} ₸</p>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-gray-500">{t('avgCheck')}</p>
                  <div className="bg-blue-50 p-2 rounded-xl">
                    <BarChart3 size={18} className="text-blue-600" />
                  </div>
                </div>
                <p className="text-3xl font-black text-blue-600">{avgCheck.toLocaleString('ru-RU')} ₸</p>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-gray-500">{t('total')} {t('orders')}</p>
                  <div className="bg-amber-50 p-2 rounded-xl">
                    <ShoppingBag size={18} className="text-amber-600" />
                  </div>
                </div>
                <p className="text-3xl font-black text-amber-600">{total}</p>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-gray-500">{t('delivered')}</p>
                  <div className="bg-green-50 p-2 rounded-xl">
                    <CheckCircle size={18} className="text-green-600" />
                  </div>
                </div>
                <p className="text-3xl font-black text-green-600">{delivered}</p>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-gray-500">Возвраты</p>
                  <div className="bg-red-50 p-2 rounded-xl">
                    <RotateCcw size={18} className="text-red-600" />
                  </div>
                </div>
                <p className="text-3xl font-black text-red-600">{returned}</p>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-gray-500">Отменено</p>
                  <div className="bg-gray-100 p-2 rounded-xl">
                    <Ban size={18} className="text-gray-500" />
                  </div>
                </div>
                <p className="text-3xl font-black text-gray-500">{cancelled}</p>
              </div>
            </div>

            {/* Прогресс доставки */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-bold text-gray-700">{t('deliveryRate')}</p>
                <span className="text-2xl font-black text-red-600">{deliveryRate}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-red-500 to-red-600 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${deliveryRate}%` }}
                />
              </div>
              <div className="flex justify-between mt-3 text-xs text-gray-400">
                <span>{t('pending')}: {pending}</span>
                <span>{t('in_transit')}: {inTransit}</span>
                <span>{t('delivered')}: {delivered}</span>
              </div>
            </div>

            {/* Графики в две колонки */}
            <div className="grid grid-cols-2 gap-6 mb-6">
              {/* График заказов по датам */}
              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                <p className="text-sm font-bold text-gray-700 mb-6">{t('ordersByDate')}</p>
                {dateEntries.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-8">{t('notFound')}</p>
                ) : (
                  <div className="flex items-end gap-3 h-40">
                    {dateEntries.map(([date, val]) => (
                      <div key={date} className="flex flex-col items-center flex-1 gap-1">
                        <span className="text-xs text-gray-500 font-bold">{val.orders}</span>
                        <div
                          className="w-full bg-red-500 rounded-t min-h-[4px] transition-all"
                          style={{ height: `${(val.orders / maxOrders) * 130}px` }}
                        />
                        <span className="text-xs text-gray-400 text-center leading-tight">{date.slice(0, 5)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* График выручки по датам */}
              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                <p className="text-sm font-bold text-gray-700 mb-6">{t('revenueByDate')}</p>
                {dateEntries.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-8">{t('notFound')}</p>
                ) : (
                  <div className="flex items-end gap-3 h-40">
                    {dateEntries.map(([date, val]) => (
                      <div key={date} className="flex flex-col items-center flex-1 gap-1">
                        <span className="text-xs text-gray-500 font-bold">{Math.round(val.revenue / 1000)}K</span>
                        <div
                          className="w-full bg-blue-500 rounded-t min-h-[4px] transition-all"
                          style={{ height: `${(val.revenue / maxRevenue) * 130}px` }}
                        />
                        <span className="text-xs text-gray-400 text-center leading-tight">{date.slice(0, 5)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Выручка по курьерам */}
            {courierEntries.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                <p className="text-sm font-bold text-gray-700 mb-4">{t('revenue')} по курьерам</p>
                <div className="flex flex-col gap-3">
                  {courierEntries.map(([name, rev]) => (
                    <div key={name}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-gray-700">{name}</span>
                        <span className="font-bold text-gray-900">{rev.toLocaleString('ru-RU')} ₸</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-green-400 to-green-600 h-2 rounded-full transition-all"
                          style={{ width: `${(rev / maxCourierRevenue) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}