'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase'
import { useCourier } from '@/lib/courier-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Search,
  FileSpreadsheet,
  Package,
  Truck,
  MapPin,
  CheckCircle,
  RotateCcw,
  Ban,
} from 'lucide-react'
import { getDisplayStage, STAGE_LABEL, STAGE_BADGE_CLASS, type DisplayStage } from '@/lib/order-status'

type Period = 'today' | 'week' | 'month' | 'all'
type CourierStage = 'not_started' | 'departed' | 'arrived' | 'delivered' | 'returned' | 'cancelled'

interface Order {
  id: string
  order_number: string
  client_address: string
  client_phone: string
  courier_stage: CourierStage
  courier_fee: number
  seller_id: string | null
  status: string
  created_at: string
}

const PERIOD_DAYS: Record<Exclude<Period, 'all' | 'today'>, number> = {
  week: 7,
  month: 30,
}

const PERIOD_LABELS: Record<Period, string> = {
  today: 'Сегодня',
  week: 'Неделя',
  month: 'Месяц',
  all: 'Всё время',
}

const ALL_SELLERS = 'all'
const ALL_STAGES = 'all'
const PAGE_SIZE = 15

const STAGE_ICON: Record<DisplayStage, typeof Package> = {
  not_started: Package,
  dropped: Package,
  departed: Truck,
  arrived: MapPin,
  delivered: CheckCircle,
  returned: RotateCcw,
  cancelled: Ban,
}

function isToday(dateString: string) {
  const date = new Date(dateString)
  const now = new Date()
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  )
}

function isWithinPeriod(dateString: string, period: Period) {
  if (period === 'all') return true
  if (period === 'today') return isToday(dateString)
  const cutoff = Date.now() - PERIOD_DAYS[period] * 24 * 60 * 60 * 1000
  return new Date(dateString).getTime() >= cutoff
}

function CourierStatsContent() {
  const supabase = useMemo(() => createClient(), [])
  const courier = useCourier()
  const searchParams = useSearchParams()
  const initialPeriod = searchParams.get('period')
  const [period, setPeriod] = useState<Period>(
    initialPeriod === 'today' || initialPeriod === 'week' || initialPeriod === 'month' || initialPeriod === 'all'
      ? initialPeriod
      : 'week',
  )
  const [sellerId, setSellerId] = useState<string>(ALL_SELLERS)
  const [orders, setOrders] = useState<Order[]>([])
  const [sellerNames, setSellerNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState<DisplayStage | typeof ALL_STAGES>(ALL_STAGES)
  const [page, setPage] = useState(1)

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, client_address, client_phone, courier_stage, courier_fee, seller_id, status, created_at')
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

  // Сбрасываем страницу на первую при смене любого фильтра, иначе можно
  // застрять на несуществующей странице с пустым списком.
  useEffect(() => {
    setPage(1)
  }, [period, sellerId, search, stageFilter])

  const sellerOptions = Array.from(
    new Set(orders.map((o) => o.seller_id).filter((id): id is string => !!id)),
  ).map((id) => ({ id, name: sellerNames[id] ?? 'Магазин' }))

  const periodOrders = orders.filter((o) => isWithinPeriod(o.created_at, period))
  const scopedOrders =
    sellerId === ALL_SELLERS ? periodOrders : periodOrders.filter((o) => o.seller_id === sellerId)

  const deliveredOrders = scopedOrders.filter((o) => o.courier_stage === 'delivered')
  const returnedOrders = scopedOrders.filter((o) => o.courier_stage === 'returned')
  const cancelledOrders = scopedOrders.filter((o) => o.courier_stage === 'cancelled')
  const earned = deliveredOrders.reduce((sum, o) => sum + (o.courier_fee ?? 0), 0)

  const tableOrders = scopedOrders
    .filter((o) => stageFilter === ALL_STAGES || getDisplayStage(o) === stageFilter)
    .filter((o) => {
      const q = search.trim().toLowerCase()
      if (!q) return true
      return (
        o.order_number.toLowerCase().includes(q) ||
        o.client_address.toLowerCase().includes(q) ||
        o.client_phone.toLowerCase().includes(q)
      )
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at))

  const tableDeliveredCount = tableOrders.filter((o) => o.courier_stage === 'delivered').length
  const totalPages = Math.max(1, Math.ceil(tableOrders.length / PAGE_SIZE))
  const paginatedOrders = tableOrders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const exportToExcel = () => {
    const data = tableOrders.map((o) => ({
      '№ заказа': o.order_number,
      'Дата': new Date(o.created_at).toLocaleDateString('ru-RU'),
      'Адрес': o.client_address,
      'Телефон': o.client_phone,
      'Магазин': o.seller_id ? sellerNames[o.seller_id] ?? 'Магазин' : '—',
      'Статус': STAGE_LABEL[getDisplayStage(o)],
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Статистика')
    XLSX.writeFile(wb, `kanexpress-courier-stats-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

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
          <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

            <Card className="rounded-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Отменено
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-black text-gray-500">{cancelledOrders.length}</p>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <div className="bg-card rounded-2xl border border-border p-4 flex flex-wrap gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-[220px] border border-border rounded-xl px-3 py-2 bg-background">
                <Search size={16} className="text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Поиск по номеру, адресу, телефону..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-transparent text-sm w-full focus:outline-none text-foreground placeholder-muted-foreground"
                />
              </div>

              <Select value={stageFilter} onValueChange={(v) => setStageFilter(v as DisplayStage | typeof ALL_STAGES)}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Статус заказа" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_STAGES}>Все статусы</SelectItem>
                  {(Object.keys(STAGE_LABEL) as DisplayStage[]).map((stage) => (
                    <SelectItem key={stage} value={stage}>
                      {STAGE_LABEL[stage]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button variant="outline" onClick={exportToExcel}>
                <FileSpreadsheet className="mr-1.5 h-4 w-4" />
                Скачать в Excel
              </Button>
            </div>

            <p className="text-sm text-muted-foreground">
              Показано: {tableOrders.length} заказов &middot; Доставлено: {tableDeliveredCount}
            </p>

            {tableOrders.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">Заказов по этим фильтрам нет</div>
            ) : (
              <Card className="rounded-2xl overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>№ заказа</TableHead>
                      <TableHead>Дата</TableHead>
                      <TableHead>Адрес клиента</TableHead>
                      <TableHead>Телефон клиента</TableHead>
                      <TableHead>Магазин</TableHead>
                      <TableHead>Статус</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedOrders.map((order) => {
                      const stage = getDisplayStage(order)
                      const StageIcon = STAGE_ICON[stage]
                      return (
                        <TableRow key={order.id}>
                          <TableCell className="font-mono font-medium">{order.order_number}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(order.created_at).toLocaleDateString('ru-RU')}
                          </TableCell>
                          <TableCell className="text-muted-foreground max-w-[220px] truncate">
                            {order.client_address}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{order.client_phone}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {order.seller_id ? sellerNames[order.seller_id] ?? 'Магазин' : '—'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`gap-1 ${STAGE_BADGE_CLASS[stage]}`}>
                              <StageIcon className="h-3 w-3" />
                              {STAGE_LABEL[stage]}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </Card>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Назад
                </Button>
                <span className="text-sm text-muted-foreground">
                  Страница {page} из {totalPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Вперёд
                </Button>
              </div>
            )}
          </div>
          </>
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
