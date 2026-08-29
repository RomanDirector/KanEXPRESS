'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase'
import type { MapPoint } from '@/components/MapGL'

const MapGL = dynamic(() => import('@/components/MapGL'), { ssr: false })

const MAP_LIMIT = 1000

type StatusFilter = 'active' | 'pending' | 'in_transit' | 'delivered' | 'all'

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'active', label: 'Активные (pending + in_transit)' },
  { value: 'pending', label: 'Ожидают' },
  { value: 'in_transit', label: 'В пути' },
  { value: 'delivered', label: 'Доставлено' },
  { value: 'all', label: 'Все статусы' },
]

interface SellerOption {
  id: string
  organization_name: string | null
}

interface OrderRow {
  id: string
  order_number: string
  client_address: string
  client_phone: string
  status: string
  price: number
  lat: number
  lng: number
  courier_name: string | null
  seller_id: string
  product_name: string | null
  sellers: { organization_name: string | null } | null
}

function applyStatusFilter(query: any, status: StatusFilter) {
  if (status === 'active') return query.in('status', ['pending', 'in_transit'])
  if (status === 'all') return query
  return query.eq('status', status)
}

export default function AdminMapPage() {
  const [sellers, setSellers] = useState<SellerOption[]>([])
  const [sellerId, setSellerId] = useState('')
  const [status, setStatus] = useState<StatusFilter>('active')
  const [points, setPoints] = useState<MapPoint[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('sellers')
      .select('id, organization_name')
      .order('organization_name')
      .then(({ data, error }) => {
        if (error) console.error(error)
        setSellers((data || []) as SellerOption[])
      })
  }, [])

  useEffect(() => {
    async function load() {
      setLoading(true)

      let countQuery = supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .not('lat', 'is', null)
        .not('lng', 'is', null)
      countQuery = applyStatusFilter(countQuery, status)
      if (sellerId) countQuery = countQuery.eq('seller_id', sellerId)

      let rowsQuery = supabase
        .from('orders')
        .select('id, order_number, client_address, client_phone, status, price, lat, lng, courier_name, seller_id, product_name, sellers(organization_name)')
        .not('lat', 'is', null)
        .not('lng', 'is', null)
        .order('created_at', { ascending: false })
        .limit(MAP_LIMIT)
      rowsQuery = applyStatusFilter(rowsQuery, status)
      if (sellerId) rowsQuery = rowsQuery.eq('seller_id', sellerId)

      const [{ count }, { data, error }] = await Promise.all([countQuery, rowsQuery])
      if (error) console.error(error)

      const rows = (data || []) as unknown as OrderRow[]
      setPoints(
        rows.map((o) => ({
          id: o.id,
          lat: o.lat,
          lng: o.lng,
          order_number: o.order_number,
          client_address: o.client_address,
          client_phone: o.client_phone,
          status: o.status,
          price: o.price,
          seller_name: o.sellers?.organization_name || '—',
          courier_name: o.courier_name,
          product_name: o.product_name,
        }))
      )
      setTotalCount(count ?? rows.length)
      setLoading(false)
    }
    load()
  }, [status, sellerId])

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-4 md:px-8 py-5">
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Карта заказов</h1>
        <p className="text-sm text-gray-400 mt-0.5">Все заказы всех продавцов</p>
      </header>

      <main className="px-4 md:px-8 py-6 max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 shadow-sm flex flex-wrap gap-3 items-center">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-400"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            value={sellerId}
            onChange={(e) => setSellerId(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-400"
          >
            <option value="">Все продавцы</option>
            {sellers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.organization_name || s.id}
              </option>
            ))}
          </select>
          <span className="text-xs text-gray-400 font-medium ml-auto">
            {loading ? 'Загрузка...' : `Показано ${points.length} из ${totalCount}`}
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-2 shadow-sm">
          <MapGL points={points} height="70vh" />
        </div>
      </main>
    </div>
  )
}
