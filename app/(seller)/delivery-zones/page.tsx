'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { assignZonesToOrders } from '@/lib/zones'
import { useLang } from '@/lib/i18n'

function MapLoading() {
  const { t } = useLang()
  return <div className="flex items-center justify-center h-96 text-gray-400">{t('mapLoading2gis')}</div>
}

const ZoneMapEditor2GIS = dynamic(() => import('@/components/ZoneMapEditor2GIS'), {
  ssr: false,
  loading: () => <MapLoading />,
})

export default function DeliveryZonesPage() {
  const { t } = useLang()
  const [assigning, setAssigning] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  async function handleAssign() {
    setAssigning(true)
    setResult(null)
    const count = await assignZonesToOrders()
    setAssigning(false)
    setResult(t('zonesAssignResult').replace('{count}', String(count)))
  }

  return (
    <div>
      <div className="flex items-center justify-between px-6 py-4 border-b bg-white">
        <div>
          <h1 className="text-xl font-black text-gray-900">{t('deliveryZones')}</h1>
          <p className="text-sm text-gray-400">{t('zonesSub')}</p>
        </div>
        <div className="flex items-center gap-3">
          {result && <span className="text-sm text-green-600 font-semibold">{result}</span>}
          <button onClick={handleAssign} disabled={assigning} className="px-4 py-2 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 disabled:opacity-50">
            {assigning ? t('zonesAssigning') : t('zonesAssignBtn')}
          </button>
        </div>
      </div>
      <ZoneMapEditor2GIS />
    </div>
  )
}
