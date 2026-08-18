'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { computeSubscriptionStatus } from '@/lib/limits'

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

interface SellerRow {
  id: string
  organization_name: string | null
  seller_subscriptions: { plan: string; expires_at: string | null; trial_ends_at: string | null } | null
}

const STATUS_LABEL: Record<'trial' | 'active' | 'expired', string> = {
  trial: 'Триал',
  active: 'Активна',
  expired: 'Истекла',
}
const STATUS_CLASS: Record<'trial' | 'active' | 'expired', string> = {
  trial: 'text-blue-700 bg-blue-50 border-blue-200',
  active: 'text-green-700 bg-green-50 border-green-200',
  expired: 'text-gray-500 bg-gray-50 border-gray-200',
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString('ru-RU') : '—'
}

// Продавцы без строки в seller_subscriptions существуют (see lib/limits.ts) —
// update() тогда не находит строк и .select() возвращает пусто, поэтому нужен
// insert как запасной путь.
async function upsertExpiresAt(sellerId: string, expiresAt: string) {
  const { data, error: updateError } = await supabase
    .from('seller_subscriptions')
    .update({ expires_at: expiresAt })
    .eq('seller_id', sellerId)
    .select('seller_id')
  if (updateError) return { error: updateError }
  if (data && data.length > 0) return { error: null }

  const { error: insertError } = await supabase
    .from('seller_subscriptions')
    .insert({ seller_id: sellerId, plan: 'free', expires_at: expiresAt })
  return { error: insertError }
}

export default function AdminSubscriptionsPage() {
  const [sellers, setSellers] = useState<SellerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setLoadError(null)
    const { data, error } = await supabase
      .from('sellers')
      .select('id, organization_name, seller_subscriptions(plan, expires_at, trial_ends_at)')
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

  useEffect(() => {
    load()
  }, [])

  async function extend(seller: SellerRow) {
    setBusyId(seller.id)
    const currentExpires = seller.seller_subscriptions?.expires_at ? Date.parse(seller.seller_subscriptions.expires_at) : NaN
    const base = !Number.isNaN(currentExpires) && currentExpires > Date.now() ? currentExpires : Date.now()
    const newExpiresAt = new Date(base + THIRTY_DAYS_MS).toISOString()
    const { error } = await upsertExpiresAt(seller.id, newExpiresAt)
    setBusyId(null)
    if (error) {
      console.error(error)
      alert('Ошибка продления: ' + error.message)
      return
    }
    await load()
  }

  async function deactivate(seller: SellerRow) {
    if (!confirm(`Деактивировать подписку у "${seller.organization_name || seller.id}"?`)) return
    setBusyId(seller.id)
    const { error } = await upsertExpiresAt(seller.id, new Date().toISOString())
    setBusyId(null)
    if (error) {
      console.error(error)
      alert('Ошибка деактивации: ' + error.message)
      return
    }
    await load()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-4 md:px-8 py-5">
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Подписки</h1>
        <p className="text-sm text-gray-400 mt-0.5">Доступ к демпингу (единственная платная функция)</p>
      </header>

      <main className="px-4 md:px-8 py-6 max-w-6xl mx-auto">
        {loading ? (
          <div className="text-center py-20 text-gray-400 text-sm">Загрузка...</div>
        ) : loadError ? (
          <div className="text-center py-20 text-red-500 text-sm">Ошибка загрузки подписок: {loadError}</div>
        ) : sellers.length === 0 ? (
          <div className="text-center py-20 text-gray-400 text-sm">Продавцов нет</div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Продавец</th>
                    <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">План</th>
                    <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Триал до</th>
                    <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Активна до</th>
                    <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Статус</th>
                    <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {sellers.map((s) => {
                    const sub = s.seller_subscriptions
                    const state = computeSubscriptionStatus({
                      expiresAt: sub?.expires_at ?? null,
                      trialEndsAt: sub?.trial_ends_at ?? null,
                    })
                    return (
                      <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-4 font-bold text-gray-900">{s.organization_name || '—'}</td>
                        <td className="px-5 py-4 text-gray-600 capitalize">{sub?.plan || 'free'}</td>
                        <td className="px-5 py-4 text-gray-500">{formatDate(sub?.trial_ends_at ?? null)}</td>
                        <td className="px-5 py-4 text-gray-500">{formatDate(sub?.expires_at ?? null)}</td>
                        <td className="px-5 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${STATUS_CLASS[state.status]}`}>
                            {STATUS_LABEL[state.status]}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex gap-2">
                            <button
                              onClick={() => extend(s)}
                              disabled={busyId === s.id}
                              className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                            >
                              +30 дней
                            </button>
                            <button
                              onClick={() => deactivate(s)}
                              disabled={busyId === s.id}
                              className="border border-red-200 text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                            >
                              Деактивировать
                            </button>
                          </div>
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
