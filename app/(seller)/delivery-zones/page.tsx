'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { assignZonesToOrders, loadZones } from '@/lib/zones'
import { supabase } from '@/lib/supabase'
import { useLang } from '@/lib/i18n'
import { Toast } from '@/components/Toast'
import type { OrderPoint } from '@/components/ZoneMapEditor'

function MapLoading() {
  const { t } = useLang()
  return <div className="flex items-center justify-center h-96 text-gray-400">{t('mapLoadingGeneric')}</div>
}

const ZoneMapEditor = dynamic(() => import('@/components/ZoneMapEditor'), {
  ssr: false,
  loading: () => <MapLoading />,
})

export default function DeliveryZonesPage() {
  const { t } = useLang()
  const [assigning, setAssigning] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [zoneCount, setZoneCount] = useState<number | null>(null)
  const [orders, setOrders] = useState<OrderPoint[]>([])
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null)

  useEffect(() => {
    loadZones()
      .then((zones) => setZoneCount(zones.length))
      .catch((error) => {
        console.error(error)
        setToast({ message: t('loadErrorPrefix') + (error?.message || String(error)), type: 'error' })
      })
  }, [])

  // Заказы поверх зон — только свои, отфильтрованы по seller_id текущей сессии.
  useEffect(() => {
    const fetchOrders = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, client_address, lat, lng, status')
        .eq('seller_id', user.id)
      if (error) {
        console.error(error.message)
        setToast({ message: t('loadErrorPrefix') + error.message, type: 'error' })
        return
      }
      const points = (data || [])
        .filter((o: any) => o.lat != null && o.lng != null)
        .map((o: any) => ({
          id: o.id,
          order_number: o.order_number,
          client_address: o.client_address,
          lat: o.lat,
          lng: o.lng,
          status: o.status,
        }))
      setOrders(points)
    }
    fetchOrders()
  }, [])

  async function handleAssign() {
    setAssigning(true)
    setResult(null)
    const { assigned, unassigned } = await assignZonesToOrders()
    setAssigning(false)
    setResult(
      t('zonesAssignResultMsg').replace('{assigned}', String(assigned)).replace('{unassigned}', String(unassigned))
    )
  }

  const noZones = zoneCount === 0

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 md:px-6 py-4 border-b bg-white">
        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-800 mb-2"
          >
            <ArrowLeft size={16} />
            {t('back')}
          </Link>
          <h1 className="text-xl font-black text-gray-900">{t('deliveryZones')}</h1>
          <p className="text-sm text-gray-400">{t('zonesSub')}</p>
        </div>
        <div className="flex items-center gap-3">
          {noZones && (
            <span className="text-sm text-amber-600 font-semibold">{t('drawZoneFirstMsg')}</span>
          )}
          {result && <span className="text-sm text-green-600 font-semibold">{result}</span>}
          <button
            onClick={handleAssign}
            disabled={assigning || noZones}
            title={noZones ? t('drawZoneFirstMsg') : undefined}
            className="px-4 py-2 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 disabled:opacity-50"
          >
            {assigning ? t('zonesAssigning') : t('zonesAssignBtn')}
          </button>
        </div>
      </div>
      {noZones && (
        <div className="px-6 py-3 bg-blue-50 border-b border-blue-100 text-sm text-blue-700">
          {t('zonesEmptyHintMsg')}
        </div>
      )}
      <ZoneMapEditor orders={orders} />

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}