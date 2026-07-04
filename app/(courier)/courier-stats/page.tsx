'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useCourier } from '@/lib/courier-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type Period = 'week' | 'month' | 'all'
type CourierStage = 'not_started' | 'departed' | 'arrived' | 'delivered' | 'returned'

interface Order {
  id: string
  courier_stage: CourierStage
  courier_fee: number
  seller_id: string | null
  created_at: string
}

const PERIOD_DAYS: Record<Exclude<Period, 'all'>, number> = {
  week: 7,
  month: 30,
}

const PERIOD_LABELS: Record<Period, string> = {
  week: 'Неделя',
  month: 'Месяц',
  all: 'Всё время',
}

const ALL_SELLERS = 'all'

function isWithinPeriod(dateString: string, period: Period) {
  if (period === 'all') return true
  const cutoff = Date.now() - PERIOD_DAYS[period] * 24 * 60 * 60 * 1000
  return new Date(dateString).getTime() >= cutoff
}

function CourierStatsContent() {
  const supabase = useMemo(() => createClient(), [])
  const courier = useCourier()
  const searchParams = useSearchParams()
  const initialPeriod = searchParams.get('period')
  const [period, setPeriod] = useState<Period>(
    initialPeriod === 'week' || initialPeriod === 'month' || initialPeriod === 'all'
      ? initialPeriod
      : 'week',
  )
  const [sellerId, setSellerId] = useState<string>(ALL_SELLERS)
  const [orders, setOrders] = useState<Order[]>([])
  const [sellerNames, setSellerNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('orders')
        .select('id, courier_stage, courier_fee, seller_id, created_at')
        .eq('courier_name', courier.full_name)

      if (error) console.error(error.message)
      else setOrders(data as Order[])
      setLoading(false)
    }

    fetchOrders()

    const channel = supabase
      .channel('courier-stats-orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, courier.full_name])

  // Подтягиваем названия магазинов по seller_id заказов — как на остальных страницах кабинета
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

  const sellerOptions = Array.from(
    new Set(orders.map((o) => o.seller_id).filter((id): id is string => !!id)),
  ).map((id) => ({ id, name: sellerNames[id] ?? 'Магазин' }))

  const periodOrders = orders.filter((o) => isWithinPeriod(o.created_at, period))
  const scopedOrders =
    sellerId === ALL_SELLERS ? periodOrders : periodOrders.filter((o) => o.seller_id === sellerId)

  const deliveredOrders = scopedOrders.filter((o) => o.courier_stage === 'delivered')
  const returnedOrders = scopedOrders.filter((o) => o.courier_stage === 'returned')
  const earned = deliveredOrders.reduce((sum, o) => sum + (o.courier_fee ?? 0), 0)

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border px-6 py-4">
        <h2 className="text-xl font-bold text-foreground">Статистика</h2>
      </header>

      <main className="px-6 py-6 max-w-5xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
            <Button
              key={p}
              size="sm"
              variant={period === p ? 'default' : 'outline'}
              onClick={() => setPeriod(p)}
            >
              {PERIOD_LABELS[p]}
            </Button>
          ))}

          <Select value={sellerId} onValueChange={setSellerId}>
            <SelectTrigger className="w-56 ml-auto">
              <SelectValue placeholder="Магазин" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_SELLERS}>Все магазины</SelectItem>
              {sellerOptions.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="text-center py-20 text-muted-foreground">Загружаем статистику...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="rounded-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Заработано
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-black text-primary">{earned} ₸</p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Доставлено
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-black text-green-600">{deliveredOrders.length}</p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Возвраты
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-black text-red-600">{returnedOrders.length}</p>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  )
}

export default function CourierStatsPage() {
  return (
    <Suspense fallback={null}>
      <CourierStatsContent />
    </Suspense>
  )
}
