'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { assignZonesToOrders } from '@/lib/zones';

const ZoneMapEditor = dynamic(() => import('@/components/ZoneMapEditor'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-96 text-gray-500">
      Загрузка карты…
    </div>
  ),
});

export default function ZonesPage() {
  const [assigning, setAssigning] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleAssign() {
    setAssigning(true);
    setResult(null);
    const count = await assignZonesToOrders();
    setAssigning(false);
    setResult(`Районы определены для ${count} заказов`);
  }

  return (
    <div>
      <div className="flex items-center justify-between px-4 py-3 border-b bg-white">
        <div>
          <h1 className="text-xl font-bold">Зоны доставки</h1>
          <p className="text-sm text-gray-500">
            Нарисуй районы — панель инструментов слева сверху на карте
          </p>
        </div>
        <div className="flex items-center gap-3">
          {result && <span className="text-sm text-green-600">{result}</span>}
          <button
            onClick={handleAssign}
            disabled={assigning}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {assigning ? 'Определяю…' : 'Определить районы заказов'}
          </button>
        </div>
      </div>
      <ZoneMapEditor />
    </div>
  );
}