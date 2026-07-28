'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { assignZonesToOrders, loadZones } from '@/lib/zones'
import { useLang } from '@/lib/i18n'
import { Toast } from '@/components/Toast'

function MapLoading() {
  return <div className="flex items-center justify-center h-96 text-gray-400">Загрузка карты…</div>
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
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null)

  useEffect(() => {
    loadZones()
      .then((zones) => setZoneCount(zones.length))
      .catch((error) => {
        console.error(error)
        setToast({ message: 'Не удалось загрузить данные, проверьте интернет-соединение', type: 'error' })
      })
  }, [])

  async function handleAssign() {
    setAssigning(true)
    setResult(null)
    const count = await assignZonesToOrders()
    setAssigning(false)
    setResult(t('zonesAssignResult').replace('{count}', String(count)))
  }

  const noZones = zoneCount === 0

  return (
    <div>
      <div className="flex items-center justify-between px-6 py-4 border-b bg-white">
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
            <span className="text-sm text-amber-600 font-semibold">Сначала нарисуйте хотя бы одну зону на карте</span>
          )}
          {result && <span className="text-sm text-green-600 font-semibold">{result}</span>}
          <button
            onClick={handleAssign}
            disabled={assigning || noZones}
            title={noZones ? 'Сначала нарисуйте хотя бы одну зону на карте' : undefined}
            className="px-4 py-2 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 disabled:opacity-50"
          >
            {assigning ? t('zonesAssigning') : t('zonesAssignBtn')}
          </button>
        </div>
      </div>
      <ZoneMapEditor />

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
