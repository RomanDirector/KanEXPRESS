'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Phone, TrendingUp, ShoppingBag, CheckCircle, BarChart3, RotateCcw, Ban } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { computeSubscriptionStatus } from '@/lib/limits'
import { ACCESS_STATUS_LABEL, ACCESS_STATUS_BADGE_CLASS, type AccessStatus } from '@/lib/access-status'

interface SellerRow {
  id: string
  organization_name: string | null
  full_name: string
  phone: string
  access_status: AccessStatus
  seller_subscriptions: { plan: string; expires_at: string | null; trial_ends_at: string | null } | null
}

interface Order {
  id: string
  status: string
  courier_stage: string | null
  price: number
  courier_name: string | null
  created_at: string
}

export default function AdminSellerDetailPage() {
  const params = useParams()
  const id = params?.id as string

  const [seller, setSeller] = useState<SellerRow | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'week' | 'month' | 'all'>('all')

  useEffect(() => {
    if (!id) return
    async function load() {
      setLoading(true)
      const [{ data: sellerData, error: sellerErr }, { data: ordersData, error: ordersErr }] = await Promise.all([
        supabase
          .from('sellers')
          .select('id, organization_name, full_name, phone, access_status, seller_subscriptions(plan, expires_at, trial_ends_at)')
          .eq('id', id)
          .maybeSingle(),
        supabase
          .from('orders')
          .select('id, status, courier_stage, price, courier_name, created_at')
          .eq('seller_id', id)
          .order('created_at', { ascending: false }),
      ])
      if (sellerErr) console.error(sellerErr)
      if (ordersErr) console.error(ordersErr)
      setSeller((sellerData as unknown as SellerRow) || null)
      setOrders((ordersData || []) as Order[])
      setLoading(false)
    }
    load()
  }, [id])

  const filtered = orders.filter((o) => {
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
  const delivered = filtered.filter((o) => o.status === 'delivered').length
  const pending = filtered.filter((o) => o.status === 'pending').length
  const inTransit = filtered.filter((o) => o.status === 'in_transit').length
  const returned = filtered.filter((o) => o.courier_stage === 'returned').length
  const cancelled = filtered.filter((o) => o.courier_stage === 'cancelled').length
  const deliveryRate = total > 0 ? Math.round((delivered / total) * 100) : 0
  const totalRevenue = filtered.reduce((sum, o) => sum + (o.price || 0), 0)
  const avgCheck = total > 0 ? Math.round(totalRevenue / total) : 0

  const byCourier: Record<string, number> = {}
  filtered.forEach((o) => {
    const name = o.courier_name || 'Не назначен'
    byCourier[name] = (byCourier[name] || 0) + (o.price || 0)
  })
  const courierEntries = Object.entries(byCourier).sort((a, b) => b[1] - a[1])
  const maxCourierRevenue = Math.max(...courierEntries.map(([, v]) => v), 1)

  const subState = seller
    ? computeSubscriptionStatus({
        expiresAt: seller.seller_subscriptions?.expires_at ?? null,
        trialEndsAt: seller.seller_subscriptions?.trial_ends_at ?? null,
      })
    : null

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-4 md:px-8 py-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/sellers" className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-800 mb-2">
            <ArrowLeft size={16} />
            Назад
          </Link>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            {loading ? 'Загрузка...' : seller?.organization_name || 'Продавец не найден'}
          </h1>
          {seller && (
            <div className="flex flex-wrap items-center gap-3 mt-2">
              <span className="text-sm text-gray-500">{seller.full_name}</span>
              <span className="flex items-center gap-1.5 text-sm text-gray-500">
                <Phone size={13} className="text-gray-400" />
                {seller.phone}
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${ACCESS_STATUS_BADGE_CLASS[seller.access_status]}`}>
                {ACCESS_STATUS_LABEL[seller.access_status]}
              </span>
              {subState && (
                <span className="px-3 py-1 rounded-full text-xs font-semibold border border-gray-200 bg-gray-50 text-gray-600 capitalize">
                  {seller.seller_subscriptions?.plan || 'free'} · {subState.status}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {(['week', 'month', 'all'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                period === p ? 'bg-red-600 text-white shadow-sm shadow-red-200' : 'border border-gray-200 text-gray-500 hover:bg-gray-100 bg-white'
              }`}
            >
              {p === 'week' ? 'Неделя' : p === 'month' ? 'Месяц' : 'Всё время'}
            </button>
          ))}
        </div>
      </header>

      <main className="px-4 md:px-8 py-6 max-w-7xl mx-auto">
        {loading ? (
          <div className="text-center py-20 text-gray-400 text-sm">Загрузка...</div>
        ) : !seller ? (
          <div className="text-center py-20 text-gray-400 text-sm">Продавец не найден</div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5 mb-6">
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-gray-500">Выручка</p>
                  <div className="bg-red-50 p-2 rounded-xl">
                    <TrendingUp size={18} className="text-red-600" />
                  </div>
                </div>
                <p className="text-3xl font-black text-gray-900">{totalRevenue.toLocaleString('ru-RU')} ₸</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-gray-500">Средний чек</p>
                  <div className="bg-blue-50 p-2 rounded-xl">
                    <BarChart3 size={18} className="text-blue-600" />
                  </div>
                </div>
                <p className="text-3xl font-black text-blue-600">{avgCheck.toLocaleString('ru-RU')} ₸</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-gray-500">Всего заказов</p>
                  <div className="bg-amber-50 p-2 rounded-xl">
                    <ShoppingBag size={18} className="text-amber-600" />
                  </div>
                </div>
                <p className="text-3xl font-black text-amber-600">{total}</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-gray-500">Доставлено</p>
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

            <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-bold text-gray-700">Процент доставки</p>
                <span className="text-2xl font-black text-red-600">{deliveryRate}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-red-500 to-red-600 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${deliveryRate}%` }}
                />
              </div>
              <div className="flex justify-between mt-3 text-xs text-gray-400">
                <span>Ожидают: {pending}</span>
                <span>В пути: {inTransit}</span>
                <span>Доставлено: {delivered}</span>
              </div>
            </div>

            {courierEntries.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                <p className="text-sm font-bold text-gray-700 mb-4">Выручка по курьерам</p>
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
