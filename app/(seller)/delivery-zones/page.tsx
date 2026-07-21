'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { assignZonesToOrders } from '@/lib/zones'

const ZoneMapEditor2GIS = dynamic(() => import('@/components/ZoneMapEditor2GIS'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-96 text-gray-400">Загрузка карты 2GIS…</div>,
})

export default function DeliveryZonesPage() {
  const [assigning, setAssigning] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  async function handleAssign() {
    setAssigning(true)
    setResult(null)
    const count = await assignZonesToOrders()
    setAssigning(false)
    setResult(`Районы определены для ${count} заказов`)
  }

  return (
    <div>
      <div className="flex items-center justify-between px-6 py-4 border-b bg-white">
        <div>
          <h1 className="text-xl font-black text-gray-900">Зоны доставки</h1>
          <p className="text-sm text-gray-400">Рисуй районы инструментом «полигон» на карте</p>
        </div>
        <div className="flex items-center gap-3">
          {result && <span className="text-sm text-green-600 font-semibold">{result}</span>}
          <button onClick={handleAssign} disabled={assigning} className="px-4 py-2 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 disabled:opacity-50">
            {assigning ? 'Определяю…' : 'Определить районы заказов'}
          </button>
        </div>
      </div>
      <ZoneMapEditor2GIS />
    </div>
  )
}