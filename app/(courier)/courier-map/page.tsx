'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase'
import { useCourier } from '@/lib/courier-context'
import type { MapPoint, MapZone, WarehousePoint } from '@/components/MapGL'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Package, Truck, CheckCircle, RotateCcw, MapPin, Phone, Navigation, Ban } from 'lucide-react'
import { getDisplayStage, STAGE_LABEL, STAGE_BADGE_CLASS, STAGE_MARKER_COLOR, type DisplayStage } from '@/lib/order-status'

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

const STAGES: DisplayStage[] = ['not_started', 'dropped', 'departed', 'arrived', 'delivered', 'returned']

const STAGE_ICON: Record<DisplayStage, typeof Package> = {
  not_started: Package,
  dropped: Package,
  departed: Truck,
  arrived: MapPin,
  delivered: CheckCircle,
  returned: RotateCcw,
  cancelled: Ban,
}

// Маршрут по координатам точнее, но они есть не у всех заказов (например,
// пока Kaspi-синк не проставил геокодирование) — в таком случае строим
// ссылку на поиск по текстовому адресу, а не молчим и не ведём в никуда.
function routeUrl(order: Order): string | null {
  if (order.lat && order.lng) {
    return `dgis://2gis.ru/routeSearch/rsType/car/to/${order.lng},${order.lat}`
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
  const [zones, setZones] = useState<MapZone[]>([])
  const [warehouses, setWarehouses] = useState<WarehousePoint[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<DisplayStage | 'all'>('all')
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

    // Зоны курьера привязаны к продавцам (zones.seller_id) — те же продавцы
    // владеют складами, чьи метки должны быть видны на карте курьера всегда,
    // независимо от фильтра по стадиям заказов.
    const fetchZonesAndWarehouses = async () => {
      const { data: zoneLinks, error } = await supabase
        .from('courier_zones')
        .select('zones(id, name, color, coordinates, seller_id)')
        .eq('courier_id', courier.id)
      if (error) {
        console.error(error.message)
        return
      }

      const linkedZones = (zoneLinks || []).map((row: any) => row.zones).filter(Boolean)
      setZones(linkedZones.map(({ seller_id, ...zone }: any) => zone))

      const sellerIds = Array.from(
        new Set(linkedZones.map((z: any) => z.seller_id).filter((id: string | null): id is string => !!id)),
      )
      if (sellerIds.length === 0) {
        setWarehouses([])
        return
      }

      const { data: sellersData, error: sellersError } = await supabase
        .from('sellers')
        .select('id, organization_name, warehouse_address, warehouse_lat, warehouse_lng')
        .in('id', sellerIds)
      if (sellersError) {
        console.error(sellersError.message)
        return
      }

      setWarehouses(
        (sellersData || [])
          .filter((s: any) => s.warehouse_lat != null && s.warehouse_lng != null)
          .map((s: any) => ({
            id: s.id,
            lat: s.warehouse_lat,
            lng: s.warehouse_lng,
            address: s.warehouse_address,
            name: s.organization_name,
          })),
      )
    }

    fetchZonesAndWarehouses()

    const channel = supabase
      .channel('courier-map-orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, courier.id, courier.full_name])

  // Escape снимает выделение заказа — без этого выбранная карточка/маркер
  // остаются подсвеченными навсегда, пока курьер не выберет другой заказ.
  useEffect(() => {
    if (!selectedId) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedId(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedId])

  const filteredOrders = filter === 'all' ? orders : orders.filter((o) => getDisplayStage(o) === filter)

  const points: MapPoint[] = filteredOrders.map((o) => ({
    id: o.id,
    lat: o.lat ?? 0,
    lng: o.lng ?? 0,
    order_number: o.order_number,
    client_address: o.client_address,
    client_phone: o.client_phone,
    status: getDisplayStage(o),
    price: o.courier_fee,
  }))

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border px-6 py-4">
        <h2 className="text-xl font-bold text-foreground">Карта заказов</h2>
      </header>

      <main className="px-6 py-6 max-w-7xl mx-auto space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={filter === 'all' ? 'default' : 'outline'}
            onClick={() => setFilter('all')}
          >
            Все ({orders.length})
          </Button>
          {STAGES.map((stage) => {
            const Icon = STAGE_ICON[stage]
            const count = orders.filter((o) => getDisplayStage(o) === stage).length
            return (
              <Button
                key={stage}
                size="sm"
                variant={filter === stage ? 'default' : 'outline'}
                onClick={() => setFilter(stage)}
              >
                <Icon className="mr-1.5 h-4 w-4" />
                {STAGE_LABEL[stage]} ({count})
              </Button>
            )
          })}
          {selectedId && (
            <Button size="sm" variant="outline" className="ml-auto" onClick={() => setSelectedId(null)}>
              Сбросить выделение
            </Button>
          )}
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
                  const stage = getDisplayStage(order)
                  const StageIcon = STAGE_ICON[stage]
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
                        <Badge variant="outline" className={`gap-1 shrink-0 ${STAGE_BADGE_CLASS[stage]}`}>
                          <StageIcon className="h-3 w-3" />
                          {STAGE_LABEL[stage]}
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
                  zones={zones}
                  warehouses={warehouses}
                  height="600px"
                  statusColors={STAGE_MARKER_COLOR}
                  selectedId={selectedId}
                  onPointClick={(point) => setSelectedId(point.id)}
                  onBackgroundClick={() => setSelectedId(null)}
                />

                <Card className="absolute bottom-4 left-4 rounded-2xl p-3 space-y-1.5 shadow-sm">
                  {STAGES.map((stage) => (
                    <div key={stage} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: STAGE_MARKER_COLOR[stage] }}
                      />
                      {STAGE_LABEL[stage]}
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
