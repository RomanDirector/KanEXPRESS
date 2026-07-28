'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useCourier } from '@/lib/courier-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Package,
  Truck,
  CheckCircle,
  RotateCcw,
  MapPin,
  Phone,
  BarChart2,
  Store,
  Ban,
} from 'lucide-react'

type CourierStage = 'not_started' | 'departed' | 'arrived' | 'delivered' | 'returned' | 'cancelled'

interface Order {
  id: string
  order_number: string
  client_phone: string
  client_address: string
  courier_stage: CourierStage
  courier_fee: number
  kaspi_pickup_code: string
  courier_name: string
  seller_id: string | null
  status: string
  created_at: string
}

const STAGE_CONFIG: Record<CourierStage, { label: string; icon: typeof Package; className: string }> = {
  not_started: { label: 'Не начато', icon: Package, className: 'border-gray-200 bg-gray-50 text-gray-600' },
  departed:    { label: 'Выехал',    icon: Truck,    className: 'border-blue-200 bg-blue-50 text-blue-700' },
  arrived:     { label: 'На месте',  icon: MapPin,   className: 'border-amber-200 bg-amber-50 text-amber-700' },
  delivered:   { label: 'Доставлено', icon: CheckCircle, className: 'border-green-200 bg-green-50 text-green-700' },
  returned:    { label: 'Возврат',   icon: RotateCcw, className: 'border-red-200 bg-red-50 text-red-700' },
  cancelled:   { label: 'Отменено',  icon: Ban,      className: 'border-red-200 bg-red-50 text-red-700' },
}

const CANCEL_REASONS: { value: string; label: string }[] = [
  { value: 'Недозвон', label: 'Недозвон (не смог связаться с клиентом)' },
  { value: 'Клиент отказался от заказа', label: 'Клиент отказался от заказа' },
  { value: 'Не смог найти адрес', label: 'Не смог найти адрес' },
  { value: 'other', label: 'Другое' },
]

function isToday(dateString: string) {
  const date = new Date(dateString)
  const now = new Date()
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  )
}

export default function CourierDashboardPage() {
  const supabase = useMemo(() => createClient(), [])
  const courier = useCourier()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [codeInputs, setCodeInputs] = useState<Record<string, string>>({})
  const [codeErrors, setCodeErrors] = useState<Record<string, string>>({})
  const [sellerNames, setSellerNames] = useState<Record<string, string>>({})
  const [todayStats, setTodayStats] = useState({ deliveredCount: 0, earned: 0 })
  const [cancelOrder, setCancelOrder] = useState<Order | null>(null)
  const [cancelReason, setCancelReason] = useState(CANCEL_REASONS[0].value)
  const [cancelComment, setCancelComment] = useState('')
  const [cancelError, setCancelError] = useState('')
  const [cancelSubmitting, setCancelSubmitting] = useState(false)
  const [locationError, setLocationError] = useState('')

  const hasDepartedOrder = orders.some((o) => o.courier_stage === 'departed')

  useEffect(() => {
    if (!hasDepartedOrder) return

    if (!('geolocation' in navigator)) {
      setLocationError('Геолокация не поддерживается вашим браузером')
      return
    }

    let lastSentAt = 0
    const THROTTLE_MS = 12_000

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const now = Date.now()
        if (now - lastSentAt < THROTTLE_MS) return
        lastSentAt = now

        supabase
          .from('couriers')
          .update({
            current_lat: position.coords.latitude,
            current_lng: position.coords.longitude,
            location_updated_at: new Date().toISOString(),
          })
          .eq('id', courier.id)
          .then(({ error }) => {
            if (error) console.error(error.message)
          })
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setLocationError('Доступ к геолокации запрещён. Включите его в настройках браузера, чтобы клиенты видели ваше местоположение.')
        } else {
          setLocationError('Не удалось определить местоположение')
        }
      },
      { enableHighAccuracy: true, maximumAge: 10_000 },
    )

    return () => {
      navigator.geolocation.clearWatch(watchId)
    }
  }, [supabase, courier.id, hasDepartedOrder])

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
      .channel('courier-orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, courier.full_name])

  // Сводка "Доставлено сегодня" / "Заработано сегодня" считается отдельным запросом,
  // т.к. основной fetchOrders выше намеренно исключает доставленные заказы из списка.
  useEffect(() => {
    const fetchTodayStats = async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('courier_fee, created_at')
        .eq('courier_name', courier.full_name)
        .eq('courier_stage', 'delivered')
      if (error) {
        console.error(error.message)
        return
      }
      const deliveredToday = (data as Pick<Order, 'courier_fee' | 'created_at'>[]).filter((o) =>
        isToday(o.created_at),
      )
      setTodayStats({
        deliveredCount: deliveredToday.length,
        earned: deliveredToday.reduce((sum, o) => sum + (o.courier_fee ?? 0), 0),
      })
    }

    fetchTodayStats()

    const channel = supabase
      .channel('courier-today-stats-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchTodayStats)
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, courier.full_name])

  // Подтягиваем названия магазинов для группировки по seller_id
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

  async function updateStage(orderId: string, stage: CourierStage) {
    const previousStage = orders.find((o) => o.id === orderId)?.courier_stage
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, courier_stage: stage } : o)),
    )

    const { error } = await supabase
      .from('orders')
      .update({ courier_stage: stage })
      .eq('id', orderId)

    if (error) {
      console.error(error.message)
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId && previousStage ? { ...o, courier_stage: previousStage } : o,
        ),
      )
    }
  }

  async function confirmDelivery(order: Order) {
    const entered = (codeInputs[order.id] ?? '').trim()

    if (entered !== order.kaspi_pickup_code) {
      setCodeErrors((prev) => ({ ...prev, [order.id]: 'Неверный код, проверьте и попробуйте снова' }))
      return
    }

    setCodeErrors((prev) => ({ ...prev, [order.id]: '' }))

    const { error } = await supabase
      .from('orders')
      .update({ courier_stage: 'delivered', status: 'delivered' })
      .eq('id', order.id)
    if (error) console.error(error.message)
  }

  function openCancelDialog(order: Order) {
    setCancelOrder(order)
    setCancelReason(CANCEL_REASONS[0].value)
    setCancelComment('')
    setCancelError('')
  }

  function closeCancelDialog() {
    setCancelOrder(null)
    setCancelError('')
    setCancelSubmitting(false)
  }

  async function submitCancel() {
    if (!cancelOrder) return

    const isOther = cancelReason === 'other'
    if (isOther && !cancelComment.trim()) {
      setCancelError('Опишите причину отмены')
      return
    }

    setCancelSubmitting(true)
    setCancelError('')

    const { error } = await supabase
      .from('orders')
      .update({
        courier_stage: 'cancelled',
        cancel_reason: isOther ? cancelComment.trim() : cancelReason,
        cancelled_by: 'courier',
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', cancelOrder.id)

    if (error) {
      console.error(error.message)
      setCancelError('Не удалось отменить заказ, попробуйте снова')
      setCancelSubmitting(false)
      return
    }

    closeCancelDialog()
  }

  const activeCount = orders.filter(
    (o) => o.courier_stage !== 'delivered' && o.courier_stage !== 'returned' && o.courier_stage !== 'cancelled',
  ).length

  const distinctSellerKeys = Array.from(new Set(orders.map((o) => o.seller_id ?? null)))
  const shouldGroup = distinctSellerKeys.length > 1

  function renderOrderCard(order: Order) {
    const stage = STAGE_CONFIG[order.courier_stage]
    const StageIcon = stage.icon

    return (
      <Card key={order.id} className="rounded-2xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono font-bold text-lg">{order.order_number}</p>
            <div className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Phone className="h-3.5 w-3.5" />
              {order.client_phone}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              {order.client_address}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <Badge variant="outline" className={`gap-1 ${stage.className}`}>
              <StageIcon className="h-3 w-3" />
              {stage.label}
            </Badge>
            <p className="text-lg font-black text-foreground">{order.courier_fee} ₸</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={order.courier_stage === 'departed' ? 'default' : 'outline'}
            onClick={() => updateStage(order.id, 'departed')}
          >
            <Truck className="mr-1.5 h-4 w-4" />
            Выехал
          </Button>
          <Button
            size="sm"
            variant={order.courier_stage === 'arrived' ? 'default' : 'outline'}
            onClick={() => updateStage(order.id, 'arrived')}
          >
            <MapPin className="mr-1.5 h-4 w-4" />
            Прибыл
          </Button>
          <Button
            size="sm"
            variant={order.courier_stage === 'returned' ? 'destructive' : 'outline'}
            onClick={() => updateStage(order.id, 'returned')}
          >
            <RotateCcw className="mr-1.5 h-4 w-4" />
            Возврат
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-destructive hover:text-destructive"
            onClick={() => openCancelDialog(order)}
          >
            <Ban className="mr-1.5 h-4 w-4" />
            Отменить
          </Button>
        </div>

        <div className="pt-3 border-t border-border space-y-1.5">
          <label className="text-xs text-muted-foreground uppercase tracking-wide">
            Код от клиента (Kaspi)
          </label>
          <div className="flex gap-2">
            <Input
              value={codeInputs[order.id] ?? ''}
              onChange={(e) =>
                setCodeInputs((prev) => ({ ...prev, [order.id]: e.target.value }))
              }
              placeholder="Введите код"
              className="max-w-[200px]"
            />
            <Button onClick={() => confirmDelivery(order)}>
              <CheckCircle className="mr-1.5 h-4 w-4" />
              Подтвердить
            </Button>
          </div>
          {codeErrors[order.id] && (
            <p className="text-sm text-destructive">{codeErrors[order.id]}</p>
          )}
        </div>
      </Card>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border px-6 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Мои заказы</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{courier.full_name}</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/courier-stats?period=week">
            <BarChart2 className="mr-1.5 h-4 w-4" />
            Посмотреть за неделю
          </Link>
        </Button>
      </header>

      <main className="px-6 py-6 max-w-5xl mx-auto space-y-6">
        {locationError && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {locationError}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="rounded-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Активные заказы
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-black text-foreground">{activeCount}</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Доставлено сегодня
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-black text-green-600">{todayStats.deliveredCount}</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Заработано сегодня
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-black text-primary">{todayStats.earned} ₸</p>
            </CardContent>
          </Card>
        </div>

        {loading ? (
          <div className="text-center py-20 text-muted-foreground">Загружаем заказы...</div>
        ) : orders.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">Активных заказов нет</div>
        ) : shouldGroup ? (
          <div className="space-y-8">
            {distinctSellerKeys.map((sellerId) => {
              const sellerOrders = orders.filter((o) => (o.seller_id ?? null) === sellerId)
              const sellerLabel = sellerId
                ? sellerNames[sellerId] ?? 'Магазин'
                : 'Без привязки к магазину'

              return (
                <div key={sellerId ?? 'no-seller'} className="space-y-4">
                  <div className="flex items-center gap-2 text-foreground">
                    <Store className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-semibold">{sellerLabel}</h3>
                  </div>
                  <div className="space-y-4">{sellerOrders.map(renderOrderCard)}</div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="space-y-4">{orders.map(renderOrderCard)}</div>
        )}
      </main>

      <Dialog open={!!cancelOrder} onOpenChange={(open) => !open && closeCancelDialog()}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Отменить заказ {cancelOrder?.order_number}</DialogTitle>
            <DialogDescription>Укажите причину отмены</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {CANCEL_REASONS.map((reason) => (
              <label
                key={reason.value}
                className="flex items-center gap-2.5 rounded-xl border border-border px-3 py-2.5 text-sm cursor-pointer transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5"
              >
                <input
                  type="radio"
                  name="cancel-reason"
                  className="h-4 w-4 accent-primary"
                  checked={cancelReason === reason.value}
                  onChange={() => setCancelReason(reason.value)}
                />
                {reason.label}
              </label>
            ))}

            {cancelReason === 'other' && (
              <Textarea
                value={cancelComment}
                onChange={(e) => setCancelComment(e.target.value)}
                placeholder="Опишите причину отмены"
                className="mt-1"
              />
            )}
          </div>

          {cancelError && <p className="text-sm text-destructive">{cancelError}</p>}

          <DialogFooter>
            <Button variant="outline" onClick={closeCancelDialog} disabled={cancelSubmitting}>
              Назад
            </Button>
            <Button variant="destructive" onClick={submitCancel} disabled={cancelSubmitting}>
              {cancelSubmitting ? 'Отменяем...' : 'Подтвердить отмену'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
