'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useCourier } from '@/lib/courier-context'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Ban } from 'lucide-react'

interface CancelledOrder {
  id: string
  order_number: string
  client_address: string
  cancel_reason: string | null
  cancelled_by: 'courier' | 'seller' | null
  cancelled_at: string | null
}

const CANCELLED_BY_LABEL: Record<string, string> = {
  courier: 'Курьер (я)',
  seller: 'Продавец',
}

function formatDateTime(dateString: string | null) {
  if (!dateString) return '—'
  return new Date(dateString).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function CourierCancelledPage() {
  const supabase = useMemo(() => createClient(), [])
  const courier = useCourier()
  const [orders, setOrders] = useState<CancelledOrder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, client_address, cancel_reason, cancelled_by, cancelled_at')
        .eq('courier_name', courier.full_name)
        .eq('courier_stage', 'cancelled')
        .order('cancelled_at', { ascending: false })

      if (error) console.error(error.message)
      else setOrders(data as CancelledOrder[])
      setLoading(false)
    }

    fetchOrders()

    const channel = supabase
      .channel('courier-cancelled-orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, courier.full_name])

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border px-6 py-4">
        <h2 className="text-xl font-bold text-foreground">Отменённые</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Заказы, отменённые по вашим доставкам</p>
      </header>

      <main className="px-6 py-6 max-w-5xl mx-auto space-y-4">
        {loading ? (
          <div className="text-center py-20 text-muted-foreground">Загружаем заказы...</div>
        ) : orders.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Ban className="h-10 w-10 mx-auto mb-4 text-muted-foreground/40" />
            Отменённых заказов нет
          </div>
        ) : (
          <Card className="rounded-2xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Номер заказа</TableHead>
                  <TableHead>Адрес</TableHead>
                  <TableHead>Причина отмены</TableHead>
                  <TableHead>Кем отменён</TableHead>
                  <TableHead>Дата отмены</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono font-medium">{order.order_number}</TableCell>
                    <TableCell className="text-muted-foreground max-w-[220px] truncate">
                      {order.client_address}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-[220px] truncate">
                      {order.cancel_reason || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="gap-1 border-red-200 bg-red-50 text-red-700">
                        <Ban className="h-3 w-3" />
                        {(order.cancelled_by && CANCELLED_BY_LABEL[order.cancelled_by]) || '—'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDateTime(order.cancelled_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </main>
    </div>
  )
}
