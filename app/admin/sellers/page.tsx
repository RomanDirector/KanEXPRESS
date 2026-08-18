'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Phone } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { computeSubscriptionStatus } from '@/lib/limits'
import { ACCESS_STATUS_LABEL, ACCESS_STATUS_BADGE_CLASS, type AccessStatus } from '@/lib/access-status'

interface SellerRow {
  id: string
  organization_name: string | null
  full_name: string
  phone: string
  access_status: AccessStatus
  seller_subscriptions: { plan: string; expires_at: string | null; trial_ends_at: string | null } | null
}

const SUB_STATUS_LABEL: Record<'trial' | 'active' | 'expired', string> = {
  trial: 'Триал',
  active: 'Активна',
  expired: 'Истекла',
}
const SUB_STATUS_CLASS: Record<'trial' | 'active' | 'expired', string> = {
  trial: 'text-blue-700 bg-blue-50 border-blue-200',
  active: 'text-green-700 bg-green-50 border-green-200',
  expired: 'text-gray-500 bg-gray-50 border-gray-200',
}

export default function AdminSellersPage() {
  const [sellers, setSellers] = useState<SellerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      setLoadError(null)
      const { data, error } = await supabase
        .from('sellers')
        .select('id, organization_name, full_name, phone, access_status, seller_subscriptions(plan, expires_at, trial_ends_at)')
        .order('organization_name')
      if (error) {
        console.error(error)
        setLoadError(error.message)
        setSellers([])
        setLoading(false)
        return
      }
      setSellers((data || []) as unknown as SellerRow[])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = sellers.filter((s) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (
      (s.organization_name || '').toLowerCase().includes(q) ||
      s.full_name.toLowerCase().includes(q) ||
      s.phone.toLowerCase().includes(q)
    )
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-4 md:px-8 py-5">
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Продавцы</h1>
        <p className="text-sm text-gray-400 mt-0.5">Все магазины системы</p>
      </header>

      <main className="px-4 md:px-8 py-6 max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 shadow-sm">
          <input
            type="text"
            placeholder="Поиск по названию, имени или телефону"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-80 border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-400"
          />
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400 text-sm">Загрузка...</div>
        ) : loadError ? (
          <div className="text-center py-20 text-red-500 text-sm">Ошибка загрузки продавцов: {loadError}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400 text-sm">Продавцы не найдены</div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Организация</th>
                    <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Имя</th>
                    <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Телефон</th>
                    <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Статус</th>
                    <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Подписка</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((s) => {
                    const sub = s.seller_subscriptions
                    const subState = computeSubscriptionStatus({
                      expiresAt: sub?.expires_at ?? null,
                      trialEndsAt: sub?.trial_ends_at ?? null,
                    })
                    return (
                      <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-4 font-bold text-gray-900">
                          <Link href={`/admin/sellers/${s.id}`} className="hover:underline">
                            {s.organization_name || '—'}
                          </Link>
                        </td>
                        <td className="px-5 py-4 text-gray-600">{s.full_name}</td>
                        <td className="px-5 py-4">
                          <span className="flex items-center gap-1.5 text-gray-600">
                            <Phone size={13} className="text-gray-400" />
                            {s.phone}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${ACCESS_STATUS_BADGE_CLASS[s.access_status]}`}>
                            {ACCESS_STATUS_LABEL[s.access_status]}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold border capitalize ${SUB_STATUS_CLASS[subState.status]}`}>
                            {sub?.plan || 'free'} · {SUB_STATUS_LABEL[subState.status]}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
