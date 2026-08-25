'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Store, Users, Package, Truck, RotateCcw, UserCheck, ArrowRight, MapPin } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { friendlyDbError } from '@/lib/db-errors'

interface DashboardCounts {
  sellersTotal: number
  sellersPending: number
  couriersTotal: number
  couriersPending: number
  ordersToday: number
  ordersWeek: number
  ordersInTransit: number
  returnsNew: number
}

// Служебные инструменты, не завязанные на статистику (менеджмент внешних
// ресурсов) — раньше были всем содержимым этой страницы ("меню разработчика").
const tools = [
  {
    href: '/admin/geocode-keys',
    icon: MapPin,
    title: 'Ключи геокодера',
    description: 'Пул ключей 2GIS для геокодирования адресов',
  },
]

async function countRows(table: string, filters: (q: any) => any): Promise<number> {
  const query = filters(supabase.from(table).select('id', { count: 'exact', head: true }))
  const { count, error } = await query
  if (error) {
    console.error(`Ошибка подсчёта ${table}:`, error)
    return 0
  }
  return count ?? 0
}

export default function AdminPage() {
  const [counts, setCounts] = useState<DashboardCounts | null>(null)
  const [loading, setLoading] = useState(true)

  // Разовый бэкфилл названий товаров: роут обрабатывает пачку за вызов, поэтому
  // дёргаем его повторно, пока remaining > 0. Прогресс и ошибки — здесь.
  const [backfillRunning, setBackfillRunning] = useState(false)
  const [backfillProgress, setBackfillProgress] = useState<string | null>(null)
  const [backfillError, setBackfillError] = useState<string | null>(null)

  async function runBackfillProductNames() {
    setBackfillRunning(true)
    setBackfillError(null)
    setBackfillProgress('Запуск…')

    let totalUpdated = 0
    let prevRemaining = Infinity

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const headers = {
        Authorization: `Bearer ${session?.access_token ?? ''}`,
        'Content-Type': 'application/json',
      }

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const res = await fetch('/api/admin/backfill-product-names', {
          method: 'POST',
          headers,
          body: JSON.stringify({ limit: 200 }),
        })
        const json = await res.json().catch(() => null)

        if (!res.ok) {
          setBackfillError(
            friendlyDbError(
              { message: json?.error },
              json?.error ?? 'Не удалось дозаполнить названия товаров',
            ),
          )
          break
        }

        totalUpdated += json.updated ?? 0
        const remaining: number = json.remaining ?? 0
        setBackfillProgress(`Обработано ${totalUpdated}, осталось ${remaining}`)

        if (remaining === 0) {
          setBackfillProgress(`Готово. Заполнено названий: ${totalUpdated}.`)
          break
        }

        // Пачка не дала прогресса (Kaspi не вернул названия для оставшихся заказов
        // или они стабильно падают) — останавливаемся, чтобы не крутиться вечно.
        if (json.processed === 0 || remaining >= prevRemaining) {
          setBackfillProgress(
            `Остановлено. Заполнено ${totalUpdated}, осталось ${remaining} — для них Kaspi не вернул названия либо запросы не прошли.`,
          )
          break
        }

        prevRemaining = remaining
      }
    } catch (err) {
      setBackfillError(
        friendlyDbError(null, err instanceof Error ? err.message : 'Ошибка сети, попробуйте ещё раз'),
      )
    } finally {
      setBackfillRunning(false)
    }
  }

  useEffect(() => {
    async function load() {
      setLoading(true)
      const now = new Date()
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

      const [
        sellersTotal,
        sellersPending,
        couriersTotal,
        couriersPending,
        ordersToday,
        ordersWeek,
        ordersInTransit,
        returnsNew,
      ] = await Promise.all([
        countRows('sellers', (q) => q),
        countRows('sellers', (q) => q.eq('access_status', 'pending')),
        countRows('couriers', (q) => q),
        countRows('couriers', (q) => q.eq('access_status', 'pending')),
        countRows('orders', (q) => q.gte('created_at', startOfToday)),
        countRows('orders', (q) => q.gte('created_at', weekAgo)),
        countRows('orders', (q) => q.eq('status', 'in_transit')),
        countRows('return_requests', (q) => q.eq('status', 'new')),
      ])

      setCounts({
        sellersTotal,
        sellersPending,
        couriersTotal,
        couriersPending,
        ordersToday,
        ordersWeek,
        ordersInTransit,
        returnsNew,
      })
      setLoading(false)
    }
    load()
  }, [])

  const pendingTotal = (counts?.sellersPending ?? 0) + (counts?.couriersPending ?? 0)

  const CARDS = [
    { label: 'Продавцов всего', value: counts?.sellersTotal, sub: counts ? `ожидают: ${counts.sellersPending}` : '', icon: Store, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Курьеров всего', value: counts?.couriersTotal, sub: counts ? `ожидают: ${counts.couriersPending}` : '', icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Заказов сегодня', value: counts?.ordersToday, sub: counts ? `за 7 дней: ${counts.ordersWeek}` : '', icon: Package, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Активных в доставке', value: counts?.ordersInTransit, sub: 'статус in_transit', icon: Truck, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Заявок на возврат', value: counts?.returnsNew, sub: 'в статусе "новая"', icon: RotateCcw, color: 'text-orange-600', bg: 'bg-orange-50' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-4 md:px-8 py-5">
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Дашборд</h1>
        <p className="text-sm text-gray-400 mt-0.5">Общая картина по системе</p>
      </header>

      <main className="px-4 md:px-8 py-6 max-w-7xl mx-auto">
        {pendingTotal > 0 && !loading && (
          <Link
            href="/admin/access"
            className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 hover:bg-amber-100 transition-all"
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-amber-800">
              <UserCheck size={18} />
              Ожидают подтверждения: {pendingTotal}
            </span>
            <ArrowRight size={16} className="text-amber-600" />
          </Link>
        )}

        {loading ? (
          <div className="text-center py-20 text-gray-400 text-sm">Загрузка...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
            {CARDS.map(({ label, value, sub, icon: Icon, color, bg }) => (
              <div key={label} className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-semibold text-gray-500">{label}</span>
                  <div className={`${bg} p-2 rounded-xl`}>
                    <Icon size={20} className={color} />
                  </div>
                </div>
                <p className={`text-4xl font-black ${color}`}>{value ?? 0}</p>
                {sub && <p className="text-xs text-gray-400 mt-2">{sub}</p>}
              </div>
            ))}
          </div>
        )}

        <div>
          <h2 className="text-sm font-bold text-gray-900 mb-3">Служебные инструменты</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {tools.map((tool) => {
              const Icon = tool.icon
              return (
                <Link key={tool.href} href={tool.href}>
                  <Card className="hover:border-primary/40 hover:shadow-md transition-all duration-200 h-full">
                    <CardHeader>
                      <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                        <Icon className="size-4 text-primary" />
                      </div>
                      <CardTitle className="text-base">{tool.title}</CardTitle>
                      <CardDescription>{tool.description}</CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              )
            })}
          </div>

          <div className="mt-4 bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Названия товаров в заказах</h3>
                <p className="text-sm text-gray-400 mt-0.5">
                  Дозаполнить названия у старых заказов, которые не покрывает обычная синхронизация.
                  Обрабатывается пачками, можно закрыть страницу и запустить позже — прогресс не потеряется.
                </p>
              </div>
              <button
                type="button"
                onClick={runBackfillProductNames}
                disabled={backfillRunning}
                className="shrink-0 inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {backfillRunning ? 'Заполняем…' : 'Дозаполнить названия товаров'}
              </button>
            </div>

            {backfillProgress && !backfillError && (
              <p className="mt-3 text-sm text-gray-600">{backfillProgress}</p>
            )}
            {backfillError && (
              <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {backfillError}
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
