'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Phone, Trash2, Wallet, Store, Users } from 'lucide-react'
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

interface Shop {
  id: string
  name: string
  owner_name: string
  phone: string
  email: string
  bin: string
  kaspi_shop_id: string
  status: string
  created_at: string
}

export default function StaffPage() {
  const { t } = useLang()
  const [tab, setTab] = useState<'couriers' | 'shops'>('couriers')
  const [couriers, setCouriers] = useState<Courier[]>([])
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)

  const fetchCouriers = async () => {
    const { data, error } = await supabase
      .from('couriers')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) console.error(error.message)
    else setCouriers(data as Courier[])
  }

  const fetchShops = async () => {
    const { data, error } = await supabase
      .from('shops')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) console.error(error.message)
    else setShops(data as Shop[])
  }

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await Promise.all([fetchCouriers(), fetchShops()])
      setLoading(false)
    }
    load()
  }, [])

  const deleteCourier = async (id: string) => {
    if (!confirm('Удалить курьера?')) return
    await supabase.from('couriers').delete().eq('id', id)
    fetchCouriers()
  }

  const deleteShop = async (id: string) => {
    if (!confirm('Удалить магазин?')) return
    await supabase.from('shops').delete().eq('id', id)
    fetchShops()
  }

  const payCourier = (courier: Courier) => {
    const phone = courier.phone.replace(/[^0-9]/g, '')
    const amount = courier.earned - courier.debt
    const msg = encodeURIComponent(
      `Здравствуйте, ${courier.full_name}! Перевожу оплату за неделю: ${amount.toLocaleString('ru-RU')} ₸. Спасибо за работу! — KanEXpress`
    )
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank')
  }

  const activeCouriers = couriers.filter(c => c.status === 'active').length
  const activeShops = shops.filter(s => s.status === 'active').length
  const totalDebt = couriers.reduce((sum, c) => sum + (c.debt || 0), 0)
  const totalEarned = couriers.reduce((sum, c) => sum + (c.earned || 0), 0)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-8 py-5">
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">{t('staff')}</h1>
        <p className="text-sm text-gray-400 mt-0.5">Курьеры и магазины</p>
      </header>

      <main className="px-8 py-6 max-w-7xl mx-auto">

        {/* Карточки статистики */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <p className="text-sm text-gray-500 font-medium">Активных курьеров</p>
            <p className="text-4xl font-black text-blue-600 mt-2">{activeCouriers}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <p className="text-sm text-gray-500 font-medium">Активных магазинов</p>
            <p className="text-4xl font-black text-green-600 mt-2">{activeShops}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <p className="text-sm text-gray-500 font-medium">Выплачено курьерам</p>
            <p className="text-3xl font-black text-gray-900 mt-2">{totalEarned.toLocaleString('ru-RU')} ₸</p>
          </div>
          <div className="bg-white rounded-2xl border border-amber-100 p-5 shadow-sm">
            <p className="text-sm text-amber-600 font-medium">Долги курьеров</p>
            <p className="text-3xl font-black text-amber-600 mt-2">{totalDebt.toLocaleString('ru-RU')} ₸</p>
          </div>
        </div>

        {/* Табы */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setTab('couriers')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              tab === 'couriers'
                ? 'bg-red-600 text-white shadow-sm shadow-red-200'
                : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}
          >
            <Users size={16} />
            Курьеры ({couriers.length})
          </button>
          <button
            onClick={() => setTab('shops')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              tab === 'shops'
                ? 'bg-red-600 text-white shadow-sm shadow-red-200'
                : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}
          >
            <Store size={16} />
            Магазины ({shops.length})
          </button>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400 text-sm">{t('loading')}</div>
        ) : tab === 'couriers' ? (

          /* ===== ТАБЛИЦА КУРЬЕРОВ ===== */
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Имя</th>
                  <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{t('phone')}</th>
                  <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{t('status')}</th>
                  <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{t('earned')}</th>
                  <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{t('debt')}</th>
                  <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">К выплате</th>
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
                    <td className="px-5 py-4 font-bold text-gray-900">{(c.earned || 0).toLocaleString('ru-RU')} ₸</td>
                    <td className="px-5 py-4 font-bold text-red-600">{(c.debt || 0).toLocaleString('ru-RU')} ₸</td>
                    <td className="px-5 py-4 font-black text-green-700">{((c.earned || 0) - (c.debt || 0)).toLocaleString('ru-RU')} ₸</td>
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

        ) : (

          /* ===== ТАБЛИЦА МАГАЗИНОВ ===== */
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Магазин</th>
                  <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Владелец</th>
                  <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{t('phone')}</th>
                  <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">БИН</th>
                  <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Kaspi Shop ID</th>
                  <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{t('status')}</th>
                  <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {shops.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-red-100 rounded-xl flex items-center justify-center">
                          <Store size={14} className="text-red-600" />
                        </div>
                        <span className="font-bold text-gray-900">{s.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-gray-600">{s.owner_name}</td>
                    <td className="px-5 py-4">
                      <span className="flex items-center gap-1.5 text-gray-600">
                        <Phone size={13} className="text-gray-400" />
                        {s.phone}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-mono text-gray-500 text-xs">{s.bin}</td>
                    <td className="px-5 py-4 font-mono text-gray-500 text-xs">{s.kaspi_shop_id || '—'}</td>
                    <td className="px-5 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                        s.status === 'active'
                          ? 'bg-green-50 border-green-200 text-green-700'
                          : 'bg-gray-50 border-gray-200 text-gray-500'
                      }`}>
                        {s.status === 'active' ? t('active') : t('inactive')}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => deleteShop(s.id)}
                        className="flex items-center gap-1.5 border border-red-200 text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                      >
                        <Trash2 size={13} />
                        {t('delete')}
                      </button>
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