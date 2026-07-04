'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MOCK_ORDERS } from '@/lib/mock-orders'

type Period = 'week' | 'month' | 'all'

const PERIOD_DAYS: Record<Exclude<Period, 'all'>, number> = {
  week: 7,
  month: 30,
}

const PERIOD_LABELS: Record<Period, string> = {
  week: 'Неделя',
  month: 'Месяц',
  all: 'Всё время',
}

function isWithinPeriod(dateString: string, period: Period) {
  if (period === 'all') return true
  const cutoff = Date.now() - PERIOD_DAYS[period] * 24 * 60 * 60 * 1000
  return new Date(dateString).getTime() >= cutoff
}

function CourierStatsContent() {
  const searchParams = useSearchParams()
  const initialPeriod = searchParams.get('period')
  const [period, setPeriod] = useState<Period>(
    initialPeriod === 'week' || initialPeriod === 'month' || initialPeriod === 'all'
      ? initialPeriod
      : 'week',
  )

  const deliveredOrders = MOCK_ORDERS.filter(
    (o) => o.courier_stage === 'delivered' && isWithinPeriod(o.created_at, period),
  )
  const returnedOrders = MOCK_ORDERS.filter(
    (o) => o.courier_stage === 'returned' && isWithinPeriod(o.created_at, period),
  )
  const earned = deliveredOrders.reduce((sum, o) => sum + o.courier_fee, 0)

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border px-6 py-4">
        <h2 className="text-xl font-bold text-foreground">Статистика</h2>
      </header>

      <main className="px-6 py-6 max-w-5xl mx-auto space-y-6">
        <div className="flex flex-wrap gap-2">
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
        </div>

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
