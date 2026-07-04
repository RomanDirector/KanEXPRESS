'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useCourier } from '@/lib/courier-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Store, Wallet, TrendingUp, CheckCircle, Package, Truck, MapPin, RotateCcw, Banknote } from 'lucide-react'

type CourierStage = 'not_started' | 'departed' | 'arrived' | 'delivered' | 'returned'

interface Order {
  id: string
  order_number: string
  courier_stage: CourierStage
  courier_fee: number
  seller_id: string | null
  status: string
  created_at: string
  is_paid_to_courier: boolean
}

const STAGE_CONFIG: Record<CourierStage, { label: string; icon: typeof Package; className: string }> = {
  not_started: { label: 'Не начато', icon: Package, className: 'border-gray-200 bg-gray-50 text-gray-600' },
  departed:    { label: 'Выехал',    icon: Truck,    className: 'border-blue-200 bg-blue-50 text-blue-700' },
  arrived:     { label: 'На месте',  icon: MapPin,   className: 'border-amber-200 bg-amber-50 text-amber-700' },
  delivered:   { label: 'Доставлено', icon: CheckCircle, className: 'border-green-200 bg-green-50 text-green-700' },
  returned:    { label: 'Возврат',   icon: RotateCcw, className: 'border-red-200 bg-red-50 text-red-700' },
}

const HISTORY_LIMIT = 15

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export default function CourierProfilePage() {
  const supabase = useMemo(() => createClient(), [])
  const courier = useCourier()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [sellerNames, setSellerNames] = useState<Record<string, string>>({})

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, courier_stage, courier_fee, seller_id, status, created_at, is_paid_to_courier')
        .eq('courier_name', courier.full_name)
        .order('created_at', { ascending: false })

      if (error) console.error(error.message)
      else setOrders(data as Order[])
      setLoading(false)
    }

    fetchOrders()

    const channel = supabase
      .channel('courier-profile-orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, courier.full_name])

  // Подтягиваем названия магазинов по seller_id заказов — как на /courier-dashboard
  useEffect(() => {
    const sellerIds = Array.from(
      new Set(orders.map((o) => o.seller_id).filter((id): id is string => !!id)),
    )
    if (sellerIds.length === 0) return

    supabase
      .from('sellers')
      .select('id, organization_name')
      .in('id', sellerIds)
      .then(({ data, error }) => {
        if (error) {
          console.error(error.message)
          return
        }
        const map: Record<string, string> = {}
        ;(data as { id: string; organization_name: string }[]).forEach((s) => {
          map[s.id] = s.organization_name
        })
        setSellerNames(map)
      })
  }, [supabase, orders])

  const deliveredOrders = orders.filter((o) => o.courier_stage === 'delivered')
  const returnedOrders = orders.filter((o) => o.courier_stage === 'returned')
  const activeOrders = orders.filter(
    (o) => o.courier_stage !== 'delivered' && o.courier_stage !== 'returned',
  )

  const totalEarned = deliveredOrders.reduce((sum, o) => sum + (o.courier_fee ?? 0), 0)
  const finishedCount = deliveredOrders.length + returnedOrders.length
  const successRate = finishedCount === 0 ? 0 : Math.round((deliveredOrders.length / finishedCount) * 100)

  const sellerIds = Array.from(
    new Set(orders.map((o) => o.seller_id).filter((id): id is string => !!id)),
  )

  const sellerSummaries = sellerIds
    .map((sellerId) => {
      const sellerOrders = orders.filter((o) => o.seller_id === sellerId)
      const sellerDelivered = sellerOrders.filter((o) => o.courier_stage === 'delivered')
      const lastOrderDate = sellerOrders.reduce(
        (latest, o) => (o.created_at > latest ? o.created_at : latest),
        sellerOrders[0].created_at,
      )

      return {
        sellerId,
        name: sellerNames[sellerId] ?? 'Магазин',
        deliveredCount: sellerDelivered.length,
        earned: sellerDelivered.reduce((sum, o) => sum + (o.courier_fee ?? 0), 0),
        lastOrderDate,
      }
    })
    .sort((a, b) => b.earned - a.earned)

  // Kaspi безналичный: курьер деньги за товар не берёт, только сверяет код
  // выдачи. Единственные деньги в системе — courier_fee за доставку, и их
  // должен продавец курьеру, а не наоборот.
  const debtSummaries = sellerIds
    .map((sellerId) => {
      const unpaidDelivered = orders.filter(
        (o) => o.seller_id === sellerId && o.courier_stage === 'delivered' && !o.is_paid_to_courier,
      )
      return {
        sellerId,
        name: sellerNames[sellerId] ?? 'Магазин',
        debt: unpaidDelivered.reduce((sum, o) => sum + (o.courier_fee ?? 0), 0),
      }
    })
    .filter((s) => s.debt > 0)
    .sort((a, b) => b.debt - a.debt)

  const historyOrders = orders.slice(0, HISTORY_LIMIT)

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border px-6 py-4">
        <h2 className="text-xl font-bold text-foreground">Профиль</h2>
        <p className="text-sm text-muted-foreground mt-0.5">{courier.full_name}</p>
      </header>

      <main className="px-6 py-6 max-w-5xl mx-auto space-y-8">
        {loading ? (
          <div className="text-center py-20 text-muted-foreground">Загружаем данные...</div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                    <Wallet className="h-4 w-4" />
                    Заработано всего
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-black text-primary">{totalEarned} ₸</p>
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                    <CheckCircle className="h-4 w-4" />
                    Доставлено заказов
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-black text-green-600">{deliveredOrders.length}</p>
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                    <TrendingUp className="h-4 w-4" />
                    Успешных доставок
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-black text-foreground">{successRate}%</p>
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                    <Package className="h-4 w-4" />
                    Активных заказов
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-black text-foreground">{activeOrders.length}</p>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 text-foreground">
                <Banknote className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold">Задолженность по магазинам</h3>
              </div>

              {debtSummaries.length === 0 ? (
                <p className="text-sm text-muted-foreground">Задолженностей нет</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {debtSummaries.map((s) => (
                    <Card
                      key={s.sellerId}
                      className="rounded-2xl p-5 space-y-2 border-amber-200 bg-amber-50"
                    >
                      <div className="flex items-center gap-2">
                        <Store className="h-4 w-4 text-amber-700" />
                        <p className="font-semibold text-amber-900 truncate">{s.name}</p>
                      </div>
                      <p className="text-sm text-amber-800">
                        Должен вам: <span className="font-bold">{s.debt} ₸</span>
                      </p>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 text-foreground">
                <Store className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold">Работаю с магазинами</h3>
              </div>

              {sellerSummaries.length === 0 ? (
                <p className="text-sm text-muted-foreground">Пока нет заказов, привязанных к магазину</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sellerSummaries.map((s) => (
                    <Card key={s.sellerId} className="rounded-2xl p-5 space-y-3">
                      <div className="flex items-center gap-2">
                        <Store className="h-4 w-4 text-muted-foreground" />
                        <p className="font-semibold text-foreground truncate">{s.name}</p>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Доставлено</span>
                        <span className="font-bold text-foreground">{s.deliveredCount}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Заработано</span>
                        <span className="font-bold text-primary">{s.earned} ₸</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Последний заказ</span>
                        <span className="font-medium text-foreground">{formatDate(s.lastOrderDate)}</span>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-foreground">История заказов</h3>

              {historyOrders.length === 0 ? (
                <p className="text-sm text-muted-foreground">Заказов пока нет</p>
              ) : (
                <Card className="rounded-2xl overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Номер заказа</TableHead>
                        <TableHead>Магазин</TableHead>
                        <TableHead>Статус</TableHead>
                        <TableHead>Сумма</TableHead>
                        <TableHead>Дата</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historyOrders.map((order) => {
                        const stage = STAGE_CONFIG[order.courier_stage]
                        const StageIcon = stage.icon
                        return (
                          <TableRow key={order.id}>
                            <TableCell className="font-mono font-medium">{order.order_number}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {order.seller_id ? sellerNames[order.seller_id] ?? 'Магазин' : '—'}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`gap-1 ${stage.className}`}>
                                <StageIcon className="h-3 w-3" />
                                {stage.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-bold">{order.courier_fee} ₸</TableCell>
                            <TableCell className="text-muted-foreground">{formatDate(order.created_at)}</TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </Card>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
