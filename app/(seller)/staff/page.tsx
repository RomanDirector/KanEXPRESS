'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Phone, Trash2, Wallet } from 'lucide-react'
import { useLang } from '@/lib/i18n'

interface Courier {
  id: string
  full_name: string
  phone: string
  status: string
  earned: number
  debt: number
  created_at: string
}

export default function StaffPage() {
  const { t } = useLang()
  const [couriers, setCouriers] = useState<Courier[]>([])
  const [loading, setLoading] = useState(true)

  const fetchCouriers = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('couriers')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) console.error(error.message)
    else setCouriers(data as Courier[])
    setLoading(false)
  }

  useEffect(() => { fetchCouriers() }, [])

  const deleteCourier = async (id: string) => {
    if (!confirm('Удалить курьера?')) return
    await supabase.from('couriers').delete().eq('id', id)
    fetchCouriers()
  }

  // Оплата через WhatsApp — открывает чат с курьером
  const payCourier = (courier: Courier) => {
    const phone = courier.phone.replace(/[^0-9]/g, '')
    const message = encodeURIComponent(
      `Здравствуйте, ${courier.full_name}! Перевожу оплату за неделю: ${courier.earned - courier.debt} ₸`
    )
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-8 py-5">
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">{t('staff')}</h1>
        <p className="text-sm text-gray-400 mt-0.5">{t('couriersTable')}</p>
      </header>

      <main className="px-8 py-6 max-w-7xl mx-auto">
        {loading ? (
          <div className="text-center py-20 text-gray-400 text-sm">{t('loading')}</div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Имя</th>
                  <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{t('phone')}</th>
                  <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{t('status')}</th>
                  <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{t('earned')}</th>
                  <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{t('debt')}</th>
                  <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {couriers.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4 font-bold text-gray-900">{c.full_name}</td>
                    <td className="px-5 py-4">
                      <span className="flex items-center gap-1.5 text-gray-600">
                        <Phone size={13} className="text-gray-400" />
                        {c.phone}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                        c.status === 'active'
                          ? 'bg-green-50 border-green-200 text-green-700'
                          : 'bg-gray-50 border-gray-200 text-gray-500'
                      }`}>
                        {c.status === 'active' ? t('active') : t('inactive')}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-bold text-gray-900">{c.earned.toLocaleString('ru-RU')} ₸</td>
                    <td className="px-5 py-4 font-bold text-red-600">{c.debt.toLocaleString('ru-RU')} ₸</td>
                    <td className="px-5 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => payCourier(c)}
                          className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                        >
                          <Wallet size={13} />
                          {t('pay')}
                        </button>
                        <button
                          onClick={() => deleteCourier(c.id)}
                          className="flex items-center gap-1.5 border border-red-200 text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                        >
                          <Trash2 size={13} />
                          {t('delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}