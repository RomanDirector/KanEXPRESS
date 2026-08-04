'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import dynamic from 'next/dynamic'
import { MapPin, Package, Truck, CheckCircle, RotateCcw, Ban, X, ArrowLeft } from 'lucide-react'
import { useLang } from '@/lib/i18n'
import { Toast } from '@/components/Toast'
import { getDisplayStage, STAGE_LABEL, STAGE_BADGE_CLASS, STAGE_MARKER_COLOR, type DisplayStage } from '@/lib/order-status'

const MapGL = dynamic(() => import('@/components/MapGL'), { ssr: false })

interface Order {
  id: string
  order_number: string
  client_phone: string
  client_address: string
  status: string
  courier_stage: string | null
  price: number
  courier_name: string | null
  lat: number | null
  lng: number | null
  created_at: string
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: React.ReactNode }> = {
  pending:    { color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200',  icon: <Package size={14} /> },
  in_transit: { color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200',    icon: <Truck size={14} /> },
  delivered:  { color: 'text-green-700',  bg: 'bg-green-50 border-green-200',  icon: <CheckCircle size={14} /> },
}

// Курьер мог принять заказ сканом (status = 'in_transit'), но ещё не нажать
// "Выехал" на своём дашборде (courier_stage остаётся 'not_started') — в этом
// окне заказ физически лежит у курьера, а не едет к клиенту.
function getStatusLabel(order: Pick<Order, 'status' | 'courier_stage'>, t: (key: any) => string): string {
  if (order.status === 'in_transit' && order.courier_stage === 'not_started') return t('shipped')
  if (order.status === 'pending' || order.status === 'in_transit' || order.status === 'delivered') {
    return t(order.status)
  }
  return order.status
}

const STAGE_ICON: Record<DisplayStage, React.ReactNode> = {
  not_started: <Package size={14} />,
  dropped: <Package size={14} />,
  departed: <Truck size={14} />,
  arrived: <MapPin size={14} />,
  delivered: <CheckCircle size={14} />,
  returned: <RotateCcw size={14} />,
  cancelled: <Ban size={14} />,
}

const ALL_STAGES = Object.keys(STAGE_LABEL) as DisplayStage[]

export default function MapPage() {
  const { t } = useLang()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null)

  const STAGE_LABEL_LOCAL: Record<DisplayStage, string> = {
    not_started: t('stageNotStarted'),
    dropped: t('stageDropped'),
    departed: t('stageDeparted'),
    arrived: t('stageArrived'),
    delivered: t('stageDelivered'),
    returned: t('stageReturned'),
    cancelled: t('stageCancelled'),
  }

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
        .select('id, order_number, client_phone, client_address, status, courier_stage, price, courier_name, lat, lng, created_at')
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false })
      if (error) {
        console.error(error.message)
        setToast({ message: t('loadErrorPrefix') + error.message, type: 'error' })
      } else setOrders(data as Order[])
      setLoading(false)
    }
    fetchOrders()
  }, [])

  // Escape снимает выделение заказа (закрывает попап), пока пользователь не
  // застревает на карте без явного способа вернуться к общему виду.
  useEffect(() => {
    if (!selectedOrder) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedOrder(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedOrder])

  const filteredOrders = orders.filter(o =>
    filterStatus === 'all' ? true : o.status === filterStatus
  )

  const mapPoints = filteredOrders
    .filter(o => o.lat && o.lng)
    .map(o => ({
      id: o.id,
      lat: o.lat!,
      lng: o.lng!,
      order_number: o.order_number,
      client_address: o.client_address,
      client_phone: o.client_phone,
      status: getDisplayStage(o),
      price: o.price,
    }))

  const handlePointClick = (point: any) => {
    const order = orders.find(o => o.id === point.id)
    if (order) setSelectedOrder(order)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-4 md:px-8 py-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-800 mb-2"
          >
            <ArrowLeft size={16} />
            {t('back')}
          </Link>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">{t('mapTitle')}</h1>
          <p className="text-sm text-gray-400 mt-0.5">{t('mapSub')}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
            {ALL_STAGES.map((s) => (
              <span key={s} className="flex items-center gap-1">
                <span
                  className="w-3 h-3 rounded-full inline-block"
                  style={{ backgroundColor: STAGE_MARKER_COLOR[s] }}
                />
                {STAGE_LABEL_LOCAL[s]}
              </span>
            ))}
          </div>
        </div>
      </header>

      <main className="px-4 md:px-8 py-6 max-w-7xl mx-auto">
        {/* Фильтр статусов */}
        <div className="flex items-center gap-2 mb-4">
          {['all', 'pending', 'in_transit', 'delivered'].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                filterStatus === s
                  ? 'bg-red-600 text-white shadow-sm shadow-red-200'
                  : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              {s === 'all' ? t('allStatuses') : t(s as any)}
              <span className="ml-2 bg-white/20 text-xs px-1.5 py-0.5 rounded-full">
                {s === 'all' ? orders.length : orders.filter(o => o.status === s).length}
              </span>
            </button>
          ))}
          {selectedOrder && (
            <button
              onClick={() => setSelectedOrder(null)}
              className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 transition-all"
            >
              <X size={14} />
              {t('clearSelection')}
            </button>
          )}
        </div>

        <div className="flex flex-col md:flex-row gap-6">
          {/* Карта */}
          <div className="flex-1 w-full">
            {loading ? (
              <div className="bg-white rounded-2xl border border-gray-100 flex items-center justify-center h-[60vh] md:h-[600px]">
                <p className="text-gray-400 text-sm">{t('loading')}</p>
              </div>
            ) : (
              <div className="h-[60vh] md:h-[600px]">
                <MapGL
                  points={mapPoints}
                  height="100%"
                  selectedId={selectedOrder?.id ?? null}
                  onPointClick={handlePointClick}
                  onBackgroundClick={() => setSelectedOrder(null)}
                  statusColors={STAGE_MARKER_COLOR}
                />
              </div>
            )}
          </div>

          {/* Список заказов */}
          <div className="w-full md:w-72 flex flex-col gap-3 max-h-[400px] md:max-h-[600px] overflow-y-auto">
            {filteredOrders.map(order => {
              const stage = getDisplayStage(order)
              return (
              <div
                key={order.id}
                onClick={() => setSelectedOrder(order)}
                className={`bg-white rounded-2xl border p-4 cursor-pointer transition-all hover:shadow-md ${
                  selectedOrder?.id === order.id
                    ? 'border-red-400 ring-2 ring-red-100'
                    : 'border-gray-100'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <span className="font-mono font-bold text-gray-900 text-sm">{order.order_number}</span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${STAGE_BADGE_CLASS[stage]}`}>
                    {STAGE_ICON[stage]}
                    {STAGE_LABEL_LOCAL[stage]}
                  </span>
                </div>
                <div className="flex items-start gap-1.5 text-xs text-gray-500">
                  <MapPin size={12} className="mt-0.5 flex-shrink-0 text-gray-400" />
                  <span className="truncate">{order.client_address}</span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-gray-400">{order.client_phone}</span>
                  {order.price > 0 && (
                    <span className="text-xs font-bold text-gray-900">{order.price.toLocaleString('ru-RU')} ₸</span>
                  )}
                </div>
                {!order.lat && (
                  <p className="text-xs text-amber-500 mt-1">⚠️ {t('noCoordinates')}</p>
                )}
              </div>
              )
            })}
          </div>
        </div>

        {/* Попап деталей заказа */}
        {selectedOrder && (
          <div
            className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedOrder(null)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-gray-900 text-lg">{t('orderDetails')}</h3>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  <X size={18} className="text-gray-500" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">{t('orderNum')}</span>
                  <span className="font-mono font-bold text-gray-900">{selectedOrder.order_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">{t('phone')}</span>
                  <span className="text-sm font-medium text-gray-900">{selectedOrder.client_phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">{t('address')}</span>
                  <span className="text-sm font-medium text-gray-900 text-right max-w-[200px]">{selectedOrder.client_address}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">{t('price')}</span>
                  <span className="font-bold text-gray-900">{selectedOrder.price?.toLocaleString('ru-RU')} ₸</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">{t('courier')}</span>
                  <span className="text-sm font-medium text-gray-900">{selectedOrder.courier_name || '—'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">{t('status')}</span>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${STAGE_BADGE_CLASS[getDisplayStage(selectedOrder)]}`}>
                    {STAGE_ICON[getDisplayStage(selectedOrder)]}
                    {STAGE_LABEL_LOCAL[getDisplayStage(selectedOrder)]}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">{t('date')}</span>
                  <span className="text-sm text-gray-500">{new Date(selectedOrder.created_at).toLocaleDateString('ru-RU')}</span>
                </div>
              </div>

              <button
                onClick={() => setSelectedOrder(null)}
                className="w-full mt-5 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl text-sm font-semibold transition-all"
              >
                {t('close')}
              </button>
            </div>
          </div>
        )}
      </main>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}