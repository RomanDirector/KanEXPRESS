'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { MapPin, Phone, Clock, Truck } from 'lucide-react'
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

interface Courier {
  id: string
  full_name: string
  phone: string
  status: string
}

export default function TrackingPage() {
  const { t } = useLang()
  const [orders, setOrders] = useState<Order[]>([])
  const [couriers, setCouriers] = useState<Courier[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)

      const ordersRes = await supabase
        .from('orders')
        .select('*')
        .eq('status', 'in_transit')
        .order('created_at', { ascending: false })

      const couriersRes = await supabase
        .from('couriers')
        .select('*')
        .eq('status', 'active')

      if (ordersRes.data) setOrders(ordersRes.data as Order[])
      if (couriersRes.data) setCouriers(couriersRes.data as Courier[])
      setLoading(false)
    }

    fetchData()

    const channel = supabase
      .channel('tracking-realtime')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, () => {
        fetchData()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const ordersByCourier: Record<string, Order[]> = {}
  orders.forEach((o) => {
    const key = o.courier_name || 'Не назначен'
    if (!ordersByCourier[key]) ordersByCourier[key] = []
    ordersByCourier[key].push(o)
  })

  const openWhatsApp = (phone: string) => {
    const cleanPhone = phone.replace(/[^0-9]/g, '')
    const msg = encodeURIComponent('Здравствуйте! Как идёт доставка?')
    window.open('https://wa.me/' + cleanPhone + '?text=' + msg, '_blank')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-8 py-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">{t('trackingTitle')}</h1>
          <p className="text-sm text-gray-400 mt-0.5">{t('trackingSub')}</p>
        </div>
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 px-4 py-2 rounded-xl">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
          <span className="text-sm font-semibold text-blue-700">В пути: {orders.length}</span>
        </div>
      </header>

      <main className="px-8 py-6 max-w-7xl mx-auto">
        {loading ? (
          <div className="text-center py-20 text-gray-400 text-sm">{t('loading')}</div>
        ) : orders.length === 0 ? (
          <div className="text-center py-20">
            <Truck size={48} className="text-gray-200 mx-auto mb-4" />
            <p className="text-gray-400 text-sm">Нет активных доставок</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {Object.entries(ordersByCourier).map(([courierName, courierOrders]) => {
              const courier = couriers.find((c) => c.full_name === courierName)
              const totalSum = courierOrders.reduce((sum, o) => sum + (o.price || 0), 0)

              return (
                <div
                  key={courierName}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
                >
                  <div className="bg-gradient-to-r from-blue-50 to-blue-100 px-6 py-4 flex items-center justify-between border-b border-blue-200">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                        <Truck size={20} className="text-white" />
                      </div>
                      <div>
                        <p className="font-black text-gray-900">{courierName}</p>
                        {courier && (
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <Phone size={11} />
                            <span>{courier.phone}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-blue-700 bg-blue-200 px-3 py-1 rounded-full">
                        {courierOrders.length} заказов
                      </span>
                      {courier && (
                        <button
                          onClick={() => openWhatsApp(courier.phone)}
                          className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                        >
                          💬 WhatsApp
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="divide-y divide-gray-50">
                    {courierOrders.map((order, idx) => (
                      <div
                        key={order.id}
                        className="px-6 py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center">
                          <span className="text-xs font-black text-blue-700">#{idx + 1}</span>
                        </div>

                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono font-bold text-gray-900 text-sm">
                              {order.order_number}
                            </span>
                            <span className="text-xs text-gray-400">|</span>
                            <span className="text-xs text-gray-500">{order.client_phone}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            <MapPin size={11} className="text-gray-400" />
                            <span>{order.client_address}</span>
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="font-bold text-gray-900 text-sm">
                            {(order.price || 0).toLocaleString('ru-RU')} ₸
                          </p>
                          <div className="flex items-center gap-1 text-xs text-blue-600 mt-0.5 justify-end">
                            <Clock size={10} />
                            <span>
                              {new Date(order.created_at).toLocaleTimeString('ru-RU', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        </div>

                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 border border-blue-200 text-blue-700">
                          <Truck size={11} />
                          {t('in_transit')}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-gray-50 px-6 py-3 flex items-center justify-between border-t border-gray-100">
                    <span className="text-xs text-gray-400">
                      Итого заказов: {courierOrders.length}
                    </span>
                    <span className="text-xs font-bold text-gray-700">
                      Сумма: {totalSum.toLocaleString('ru-RU')} ₸
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}