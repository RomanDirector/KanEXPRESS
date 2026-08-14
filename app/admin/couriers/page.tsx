'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Phone, Truck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { ACCESS_STATUS_LABEL, ACCESS_STATUS_BADGE_CLASS, type AccessStatus } from '@/lib/access-status'

interface CourierRow {
  id: string
  full_name: string
  phone: string
  car_number: string | null
  access_status: AccessStatus
  courier_zones: { zones: { name: string } | null }[]
}

export default function AdminCouriersPage() {
  const [couriers, setCouriers] = useState<CourierRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from('couriers')
        .select('id, full_name, phone, car_number, access_status, courier_zones(zones(name))')
        .order('full_name')
      if (error) console.error(error)

      // Дедупликация по id: courier_zones — one-to-many, один курьер с
      // несколькими зонами не должен превращаться в несколько строк списка.
      const byId = new Map<string, CourierRow>()
      for (const row of (data || []) as unknown as CourierRow[]) {
        const existing = byId.get(row.id)
        if (existing) {
          existing.courier_zones = existing.courier_zones.concat(row.courier_zones)
        } else {
          byId.set(row.id, { ...row, courier_zones: [...row.courier_zones] })
        }
      }
      setCouriers(Array.from(byId.values()))
      setLoading(false)
    }
    load()
  }, [])

  const filtered = couriers.filter((c) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return c.full_name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q)
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-4 md:px-8 py-5">
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Курьеры</h1>
        <p className="text-sm text-gray-400 mt-0.5">Все курьеры системы</p>
      </header>

      <main className="px-4 md:px-8 py-6 max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 shadow-sm">
          <input
            type="text"
            placeholder="Поиск по имени или телефону"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-80 border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-400"
          />
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400 text-sm">Загрузка...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400 text-sm">Курьеры не найдены</div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Имя</th>
                    <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Телефон</th>
                    <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Транспорт</th>
                    <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Статус</th>
                    <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Зоны</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => (window.location.href = `/admin/couriers/${c.id}`)}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <td className="px-5 py-4 font-bold text-gray-900">
                        <Link href={`/admin/couriers/${c.id}`} className="hover:underline">
                          {c.full_name}
                        </Link>
                      </td>
                      <td className="px-5 py-4">
                        <span className="flex items-center gap-1.5 text-gray-600">
                          <Phone size={13} className="text-gray-400" />
                          {c.phone}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="flex items-center gap-1.5 text-gray-600">
                          <Truck size={13} className="text-gray-400" />
                          {c.car_number || '—'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${ACCESS_STATUS_BADGE_CLASS[c.access_status]}`}>
                          {ACCESS_STATUS_LABEL[c.access_status]}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-gray-600">
                        {(() => {
                          const names = Array.from(new Set(c.courier_zones.map((cz) => cz.zones?.name).filter((n): n is string => !!n)))
                          return names.length === 0 ? <span className="text-gray-400 text-xs">—</span> : names.join(', ')
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
