'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, Crown, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getSellerPlan } from '@/lib/subscription'

interface SellerData {
  full_name: string
  phone: string
  email: string | null
  organization_name: string
  organization_address: string
}

const FIELDS: { key: keyof SellerData; label: string }[] = [
  { key: 'full_name', label: 'ФИО' },
  { key: 'phone', label: 'Телефон' },
  { key: 'email', label: 'Email' },
  { key: 'organization_name', label: 'Организация' },
  { key: 'organization_address', label: 'Адрес организации' },
]

export default function ProfilePage() {
  const router = useRouter()
  const [seller, setSeller] = useState<SellerData | null>(null)
  const [plan, setPlan] = useState<'free' | 'pro'>('free')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const [{ data: sellerData }, sellerPlan] = await Promise.all([
        supabase.from('sellers').select('*').eq('id', user.id).single(),
        getSellerPlan(user.id),
      ])

      setSeller(sellerData as SellerData)
      setPlan(sellerPlan)
      setLoading(false)
    }
    load()
  }, [router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-8 py-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Профиль</h1>
          <p className="text-sm text-gray-400 mt-0.5">Данные вашего аккаунта и подписки</p>
        </div>
      </header>

      <main className="px-8 py-6 max-w-3xl mx-auto space-y-6">
        {/* Данные продавца */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 mb-4">Данные продавца</h2>
          {loading ? (
            <p className="text-gray-400 text-sm">Загрузка…</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {FIELDS.map((f) => (
                <div key={f.key}>
                  <p className="text-xs text-gray-400 mb-1">{f.label}</p>
                  <p className="text-sm font-semibold text-gray-900">{seller?.[f.key] || '—'}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Подписка */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 mb-4">Подписка</h2>

          <div className="flex items-center gap-3 mb-5">
            <span
              className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-black uppercase tracking-wide ${
                plan === 'pro'
                  ? 'bg-gradient-to-r from-amber-400 to-red-500 text-white shadow-sm shadow-amber-200'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              {plan === 'pro' && <Crown size={14} />}
              {plan === 'pro' ? 'Pro' : 'Free'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            <div className="rounded-xl border border-gray-100 p-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Free</p>
              <p className="text-sm text-gray-700">Базовые функции</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
              <p className="text-xs font-bold text-amber-600 uppercase tracking-wide mb-2 flex items-center gap-1">
                <Check size={13} /> Pro
              </p>
              <p className="text-sm text-gray-700">Все функции без ограничений</p>
            </div>
          </div>

          <button
            onClick={() => alert('Скоро будет доступно')}
            className="px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-all"
          >
            Улучшить до Pro
          </button>
        </div>

        {/* Выход */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 transition-all"
        >
          <LogOut size={16} />
          Выйти
        </button>
      </main>
    </div>
  )
}
