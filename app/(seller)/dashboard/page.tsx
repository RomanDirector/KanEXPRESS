'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Download, X } from 'lucide-react'

type OrderStatus = 'pending' | 'in_transit' | 'delivered'

interface Order {
  id: string
  order_number: string
  client_phone: string
  client_address: string
  status: OrderStatus
  created_at: string
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  pending:    { label: 'Не отгружено', variant: 'outline' },
  in_transit: { label: 'В пути',       variant: 'secondary' },
  delivered:  { label: 'Доставлено',   variant: 'default' },
}

export default function SellerDashboard() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<OrderStatus | 'all'>('all')
  const [filterDate, setFilterDate] = useState('')
  const [search, setSearch] = useState('')

  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) console.error(error.message)
      else setOrders(data as Order[])
      setLoading(false)
    }
    fetchOrders()
    const channel = supabase
      .channel('orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase])

  const filtered = orders.filter((o) => {
    const matchStatus = filterStatus === 'all' || o.status === filterStatus
    const matchDate = !filterDate || o.created_at.startsWith(filterDate)
    const matchSearch =
      o.order_number.toLowerCase().includes(search.toLowerCase()) ||
      o.client_phone.includes(search) ||
      o.client_address.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchDate && matchSearch
  })

  const hasFilters = filterStatus !== 'all' || filterDate || search

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border px-6 py-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">Dashboard</h2>
        <Button asChild>
          <Link href="/invoices">
            <Download className="mr-2 h-4 w-4" />
            Скачать накладные
          </Link>
        </Button>
      </header>

      <main className="px-6 py-6 max-w-7xl mx-auto space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {(Object.entries(STATUS_CONFIG) as [OrderStatus, typeof STATUS_CONFIG[OrderStatus]][]).map(([key, cfg]) => (
            <Card key={key}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {cfg.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-black text-foreground">
                  {orders.filter(o => o.status === key).length}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <Input
            placeholder="Поиск по номеру, телефону, адресу..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 min-w-[220px]"
          />
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as OrderStatus | 'all')}
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="all">Все статусы</option>
            <option value="pending">Не отгружено</option>
            <option value="in_transit">В пути</option>
            <option value="delivered">Доставлено</option>
          </select>
          <Input
            type="date"
            value={filterDate}
            onChange={e => setFilterDate(e.target.value)}
            className="w-auto"
          />
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setFilterStatus('all'); setFilterDate(''); setSearch('') }}
            >
              <X className="mr-1 h-4 w-4" />
              Сбросить
            </Button>
          )}
        </div>

        {loading ? (
          <div className="text-center py-20 text-muted-foreground">Загружаем заказы...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">Заказов не найдено</div>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>№ Заказа</TableHead>
                  <TableHead>Телефон</TableHead>
                  <TableHead>Адрес</TableHead>
                  <TableHead>Дата</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Накладная</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono font-bold">{order.order_number}</TableCell>
                    <TableCell className="text-muted-foreground">{order.client_phone}</TableCell>
                    <TableCell className="text-muted-foreground max-w-[200px] truncate">{order.client_address}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(order.created_at).toLocaleDateString('ru-RU')}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_CONFIG[order.status].variant}>
                        {STATUS_CONFIG[order.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href="/invoices">
                          <Download className="mr-1 h-3 w-3" />
                          PDF
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}

        {!loading && (
          <p className="text-sm text-muted-foreground">
            Показано {filtered.length} из {orders.length} заказов
          </p>
        )}
      </main>
    </div>
  )
}
