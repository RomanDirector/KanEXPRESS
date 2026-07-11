'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase';

const CourierTrackingMap = dynamic(
  () => import('@/components/CourierTrackingMap'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-96 text-gray-500">
        Загрузка карты…
      </div>
    ),
  }
);

interface CourierWithOrders {
  id: string;
  name: string;
  phone: string;
  orders: { id: string; number: string; client_address: string }[];
}

export default function TrackingPage() {
  const [tab, setTab] = useState<'list' | 'map'>('map');
  const [couriers, setCouriers] = useState<CourierWithOrders[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadList();
  }, []);

  async function loadList() {
    setLoading(true);

    const { data: courierRows } = await supabase
      .from('couriers')
      .select('id, name, phone');

    const { data: orderRows } = await supabase
      .from('orders')
      .select('id, number, client_address, courier_id')
      .eq('status', 'in_transit');

    const result: CourierWithOrders[] = (courierRows || []).map((c: any) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      orders: (orderRows || []).filter((o: any) => o.courier_id === c.id),
    }));

    setCouriers(result);
    setLoading(false);
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Отслеживание</h1>
        <div className="flex rounded-lg border overflow-hidden">
          <button
            onClick={() => setTab('map')}
            className={`px-4 py-2 text-sm font-semibold ${
              tab === 'map' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'
            }`}
          >
            Карта
          </button>
          <button
            onClick={() => setTab('list')}
            className={`px-4 py-2 text-sm font-semibold ${
              tab === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'
            }`}
          >
            Список
          </button>
        </div>
      </div>

      {tab === 'map' && <CourierTrackingMap />}

      {tab === 'list' && (
        <div className="space-y-4">
          {loading && <p className="text-gray-500">Загрузка…</p>}
          {!loading && couriers.length === 0 && (
            <p className="text-gray-500">Курьеров нет</p>
          )}
          {couriers.map((c) => (
            <div key={c.id} className="bg-white rounded-xl border p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="font-bold">{c.name}</span>
                  <span className="text-gray-500 ml-3">{c.phone}</span>
                </div>
                <span className="text-sm bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-semibold">
                  В пути: {c.orders.length}
                </span>
              </div>
              {c.orders.length > 0 && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500">
                      <th className="py-1 pr-4">#</th>
                      <th className="py-1">Адрес</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.orders.map((o) => (
                      <tr key={o.id} className="border-t">
                        <td className="py-1 pr-4 text-blue-600 font-semibold">
                          {o.number}
                        </td>
                        <td className="py-1">{o.client_address}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}