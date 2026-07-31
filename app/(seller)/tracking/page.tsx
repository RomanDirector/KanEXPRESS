'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useLang } from '@/lib/i18n'
import { getSellerCourierIds } from '@/lib/couriers'
import { Toast } from '@/components/Toast'

function MapLoading() {
  const { t } = useLang()
  return <div className="flex items-center justify-center h-96 text-gray-400">{t('loading')}</div>
}

const CourierTrackingMap = dynamic(() => import('@/components/CourierTrackingMap'), {
  ssr: false,
  loading: () => <MapLoading />,
})

interface CourierWithOrders {
  id: string; full_name: string; phone: string
  orders: { id: string; order_number: string; client_address: string }[]
}

export default function TrackingPage() {
  const { t } = useLang()
  const [tab, setTab] = useState<'list' | 'map'>('map')
  const [couriers, setCouriers] = useState<CourierWithOrders[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null)

  useEffect(() => { loadList() }, [])

  async function loadList() {
    setLoading(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }
    const courierIds = await getSellerCourierIds(user.id)
    const { data: courierRows, error: courierErr } =
      courierIds.length === 0
        ? { data: [] as { id: string; full_name: string; phone: string }[], error: null }
        : await supabase.from('couriers').select('id, full_name, phone').in('id', courierIds)
    const { data: orderRows, error: orderErr } = await supabase
      .from('orders').select('id, order_number, client_address, courier_name, status')
      .eq('seller_id', user.id)
      .eq('status', 'in_transit')
    if (courierErr || orderErr) {
      if (courierErr) console.error(courierErr)
      if (orderErr) console.error(orderErr)
      setToast({ message: t('loadErrorPrefix') + (courierErr?.message || orderErr?.message), type: 'error' })
    }

    const result: CourierWithOrders[] = (courierRows || []).map((c: any) => ({
      id: c.id, full_name: c.full_name, phone: c.phone,
      orders: (orderRows || []).filter((o: any) => o.courier_name === c.full_name),
    }))

    setCouriers(result)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-8 py-5 flex items-center justify-between">
        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-800 mb-2"
          >
            <ArrowLeft size={16} />
            {t('back')}
          </Link>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">{t('tracking')}</h1>
          <p className="text-sm text-gray-400 mt-0.5">{t('trackingSub')}</p>
        </div>
        <div className="flex rounded-xl border overflow-hidden">
          <button onClick={() => setTab('map')} className={`px-4 py-2 text-sm font-bold ${tab === 'map' ? 'bg-red-600 text-white' : 'bg-white text-gray-500'}`}>{t('map')}</button>
          <button onClick={() => setTab('list')} className={`px-4 py-2 text-sm font-bold ${tab === 'list' ? 'bg-red-600 text-white' : 'bg-white text-gray-500'}`}>{t('list')}</button>
        </div>
      </header>

      <main className="px-8 py-6 max-w-7xl mx-auto">
        {tab === 'map' && <CourierTrackingMap />}

        {tab === 'list' && (
          <div className="space-y-4">
            {loading && <p className="text-gray-400">{t('loading')}</p>}
            {!loading && couriers.length === 0 && <p className="text-gray-400">{t('noCouriers')}</p>}
            {couriers.map((c) => (
              <div key={c.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div><span className="font-bold">{c.full_name}</span><span className="text-gray-400 ml-3 text-sm">{c.phone}</span></div>
                  <span className="text-sm bg-red-50 text-red-600 px-3 py-1 rounded-full font-bold">{t('inTransitCount').replace('{count}', String(c.orders.length))}</span>
                </div>
                {c.orders.length > 0 && (
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-gray-400 text-xs uppercase"><th className="py-1 pr-4">#</th><th className="py-1">{t('address')}</th></tr></thead>
                    <tbody>
                      {c.orders.map((o) => (
                        <tr key={o.id} className="border-t border-gray-50">
                          <td className="py-1.5 pr-4 font-mono font-bold text-gray-900">{o.order_number}</td>
                          <td className="py-1.5 text-gray-500">{o.client_address}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}