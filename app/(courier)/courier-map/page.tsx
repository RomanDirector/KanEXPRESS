'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase'
import { useCourier } from '@/lib/courier-context'
import type { MapPoint } from '@/components/MapGL'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Package, Truck, CheckCircle, RotateCcw, MapPin, Phone, Navigation } from 'lucide-react'

const MapGL = dynamic(() => import('@/components/MapGL'), { ssr: false })

type CourierStage = 'not_started' | 'departed' | 'arrived' | 'delivered' | 'returned'

interface Order {
  id: string
  order_number: string
  client_phone: string
  client_address: string
  courier_stage: CourierStage
  courier_fee: number
  courier_name: string
  status: string
  created_at: string
  lat: number | null
  lng: number | null
}

const STAGES: CourierStage[] = ['not_started', 'departed', 'arrived', 'delivered', 'returned']

const STAGE_CONFIG: Record<CourierStage, { label: string; icon: typeof Package; className: string }> = {
  not_started: { label: 'Не начато', icon: Package, className: 'border-gray-200 bg-gray-50 text-gray-600' },
  departed:    { label: 'Выехал',    icon: Truck,    className: 'border-blue-200 bg-blue-50 text-blue-700' },
  arrived:     { label: 'На месте',  icon: MapPin,   className: 'border-amber-200 bg-amber-50 text-amber-700' },
  delivered:   { label: 'Доставлено', icon: CheckCircle, className: 'border-green-200 bg-green-50 text-green-700' },
  returned:    { label: 'Возврат',   icon: RotateCcw, className: 'border-red-200 bg-red-50 text-red-700' },
}

const STAGE_MARKER_COLORS: Record<CourierStage, string> = {
  not_started: '#9ca3af',
  departed: '#3b82f6',
  arrived: '#f59e0b',
  delivered: '#22c55e',
  returned: '#ef4444',
}

// Маршрут по координатам точнее, но они есть не у всех заказов (например,
// пока Kaspi-синк не проставил геокодирование) — в таком случае строим
// ссылку на поиск по текстовому адресу, а не молчим и не ведём в никуда.
function routeUrl(order: Order): string | null {
  if (order.lat && order.lng) {
    return `https://2gis.kz/routeSearch/rsType/car/to/${order.lng},${order.lat}`
  }
  if (order.client_address) {
    return `https://2gis.kz/almaty/search/${encodeURIComponent(order.client_address)}`
  }
  return null
}

export default function CourierMapPage() {
  const supabase = useMemo(() => createClient(), [])
  const courier = useCourier()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<CourierStage | 'all'>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('courier_name', courier.full_name)
        .neq('courier_stage', 'delivered')
        .neq('courier_stage', 'cancelled')
        .order('created_at', { ascending: true })
      if (error) console.error(error.message)
      else setOrders(data as Order[])
      setLoading(false)
    }

    fetchOrders()

    const channel = supabase
      .channel('courier-map-orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, courier.full_name])

  const filteredOrders = filter === 'all' ? orders : orders.filter((o) => o.courier_stage === filter)

  const points: MapPoint[] = filteredOrders.map((o) => ({
    id: o.id,
    lat: o.lat ?? 0,
    lng: o.lng ?? 0,
    order_number: o.order_number,
    client_address: o.client_address,
    client_phone: o.client_phone,
    status: o.courier_stage,
    price: o.courier_fee,
  }))

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border px-6 py-4">
        <h2 className="text-xl font-bold text-foreground">Карта заказов</h2>
      </header>

      <main className="px-6 py-6 max-w-7xl mx-auto space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={filter === 'all' ? 'default' : 'outline'}
            onClick={() => setFilter('all')}
          >
            Все ({orders.length})
          </Button>
          {STAGES.map((stage) => {
            const cfg = STAGE_CONFIG[stage]
            const Icon = cfg.icon
            const count = orders.filter((o) => o.courier_stage === stage).length
            return (
              <Button
                key={stage}
                size="sm"
                variant={filter === stage ? 'default' : 'outline'}
                onClick={() => setFilter(stage)}
              >
                <Icon className="mr-1.5 h-4 w-4" />
                {cfg.label} ({count})
              </Button>
            )
          })}
        </div>

        {loading ? (
          <div className="text-center py-20 text-muted-foreground">Загружаем заказы...</div>
        ) : (
          <div className="flex gap-6 items-start">
            <div className="w-96 shrink-0 space-y-3">
              {filteredOrders.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">Заказов нет</div>
              ) : (
                filteredOrders.map((order) => {
                  const stage = STAGE_CONFIG[order.courier_stage]
                  const StageIcon = stage.icon
                  const isSelected = order.id === selectedId
                  const route = routeUrl(order)

                  return (
                    <Card
                      key={order.id}
                      onClick={() => setSelectedId(order.id)}
                      className={`rounded-2xl p-4 space-y-3 cursor-pointer transition-colors ${
                        isSelected ? 'border-primary ring-1 ring-primary' : 'hover:border-primary/40'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-mono font-bold">{order.order_number}</p>
                          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {order.client_phone}
                          </div>
                          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {order.client_address}
                          </div>
                        </div>
                        <Badge variant="outline" className={`gap-1 shrink-0 ${stage.className}`}>
                          <StageIcon className="h-3 w-3" />
                          {stage.label}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between">
                        <p className="font-black text-foreground">{order.courier_fee} ₸</p>
                        {route ? (
                          <a
                            href={route}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button size="sm" variant="outline">
                              <Navigation className="mr-1.5 h-3.5 w-3.5" />
                              Маршрут в 2ГИС
                            </Button>
                          </a>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled
                            title="Адрес не указан"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Navigation className="mr-1.5 h-3.5 w-3.5" />
                            Маршрут в 2ГИС
                          </Button>
                        )}
                      </div>
                    </Card>
                  )
                })
              )}
            </div>

            <div className="flex-1 space-y-3">
              <div className="relative">
                <MapGL
                  points={points}
                  height="600px"
                  statusColors={STAGE_MARKER_COLORS}
                  selectedId={selectedId}
                  onPointClick={(point) => setSelectedId(point.id)}
                />

                <Card className="absolute bottom-4 left-4 rounded-2xl p-3 space-y-1.5 shadow-sm">
                  {STAGES.map((stage) => (
                    <div key={stage} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: STAGE_MARKER_COLORS[stage] }}
                      />
                      {STAGE_CONFIG[stage].label}
                    </div>
                  ))}
                </Card>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
