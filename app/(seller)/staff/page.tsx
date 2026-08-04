'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Phone, Trash2, Wallet, Users, Link2, X, Warehouse } from 'lucide-react'
import { useLang } from '@/lib/i18n'
import { useSeller } from '@/lib/seller-context'
import { Toast } from '@/components/Toast'

interface Courier {
  id: string
  full_name: string
  phone: string
  status: string
  earned: number
  debt: number
  created_at: string
}

interface CourierOption {
  id: string
  full_name: string
  phone: string
}

interface ZoneOption {
  id: string
  name: string
  color: string
}

interface ZoneLink {
  id: string
  zone_id: string
  zone_name: string
  zone_color: string
}

interface CourierWithZones extends Courier {
  zoneLinks: ZoneLink[]
}

export default function StaffPage() {
  const { t } = useLang()
  const seller = useSeller()
  const [couriers, setCouriers] = useState<CourierWithZones[]>([])
  const [allCouriers, setAllCouriers] = useState<CourierOption[]>([])
  const [sellerZones, setSellerZones] = useState<ZoneOption[]>([])
  const [loading, setLoading] = useState(true)

  const [showAssignModal, setShowAssignModal] = useState(false)
  const [assignCourierId, setAssignCourierId] = useState('')
  const [assignZoneId, setAssignZoneId] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null)
  const [unassigningId, setUnassigningId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [warehouseAddress, setWarehouseAddress] = useState('')
  const [warehouseCoords, setWarehouseCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [savingWarehouse, setSavingWarehouse] = useState(false)
  const [warehouseSaved, setWarehouseSaved] = useState(false)

  // Курьеры, привязанные к зонам текущего продавца — join через courier_zones/zones,
  // а не прямой select('*') из couriers (курьеры общие на всю систему).
  const fetchCouriers = async () => {
    const { data, error } = await supabase
      .from('courier_zones')
      .select('id, zone_id, couriers(*), zones!inner(name, color, seller_id)')
      .eq('zones.seller_id', seller.id)
    if (error) {
      console.error(error.message)
      setToast({ message: 'Не удалось загрузить курьеров: ' + error.message, type: 'error' })
      return
    }

    const byCourier = new Map<string, CourierWithZones>()
    for (const row of (data || []) as any[]) {
      const courier = row.couriers as Courier | null
      if (!courier) continue
      if (!byCourier.has(courier.id)) {
        byCourier.set(courier.id, { ...courier, zoneLinks: [] })
      }
      byCourier.get(courier.id)!.zoneLinks.push({
        id: row.id,
        zone_id: row.zone_id,
        zone_name: row.zones.name,
        zone_color: row.zones.color,
      })
    }
    setCouriers(Array.from(byCourier.values()))
  }

  // Полный список курьеров для модалки привязки — курьеры общие на всю систему.
  const fetchAllCouriers = async () => {
    const { data, error } = await supabase
      .from('couriers')
      .select('id, full_name, phone')
      .order('full_name')
    if (error) console.error(error.message)
    else setAllCouriers(data as CourierOption[])
  }

  const fetchSellerZones = async () => {
    const { data, error } = await supabase
      .from('zones')
      .select('id, name, color')
      .eq('seller_id', seller.id)
      .order('name')
    if (error) console.error(error.message)
    else setSellerZones(data as ZoneOption[])
  }

  const fetchWarehouse = async () => {
    const { data, error } = await supabase
      .from('sellers')
      .select('warehouse_address, warehouse_lat, warehouse_lng')
      .eq('id', seller.id)
      .maybeSingle()
    if (error) {
      console.error(error.message)
      return
    }
    setWarehouseAddress(data?.warehouse_address || '')
    setWarehouseCoords(
      data?.warehouse_lat != null && data?.warehouse_lng != null
        ? { lat: data.warehouse_lat, lng: data.warehouse_lng }
        : null,
    )
  }

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await Promise.all([fetchCouriers(), fetchAllCouriers(), fetchSellerZones(), fetchWarehouse()])
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seller.id])

  useEffect(() => {
    if (!showAssignModal) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowAssignModal(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showAssignModal])

  const saveWarehouseAddress = async () => {
    const trimmed = warehouseAddress.trim()
    if (!trimmed) {
      setToast({ message: 'Укажите адрес склада', type: 'error' })
      return
    }

    setSavingWarehouse(true)
    setWarehouseSaved(false)

    const res = await fetch('/api/geocode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: trimmed }),
    })
    const result = await res.json()

    if (!result.success) {
      setSavingWarehouse(false)
      setToast({ message: 'Не удалось определить координаты: ' + (result.error || ''), type: 'error' })
      return
    }

    const { error } = await supabase
      .from('sellers')
      .update({ warehouse_address: trimmed, warehouse_lat: result.lat, warehouse_lng: result.lng })
      .eq('id', seller.id)

    setSavingWarehouse(false)

    if (error) {
      setToast({ message: 'Ошибка сохранения: ' + error.message, type: 'error' })
      return
    }

    setWarehouseCoords({ lat: result.lat, lng: result.lng })
    setWarehouseSaved(true)
    setTimeout(() => setWarehouseSaved(false), 3000)
  }

  const openAssignModal = () => {
    setAssignCourierId('')
    setAssignZoneId('')
    setShowAssignModal(true)
  }

  const assignCourierToZone = async () => {
    if (!assignCourierId || !assignZoneId) return
    setAssigning(true)
    const { error } = await supabase
      .from('courier_zones')
      .insert({ courier_id: assignCourierId, zone_id: assignZoneId })
    setAssigning(false)
    if (error) {
      const isDuplicate = error.code === '23505' || error.message.includes('courier_zones_courier_id_zone_id_key')
      if (isDuplicate) {
        setToast({ message: 'Этот курьер уже привязан к этой зоне', type: 'error' })
      } else {
        setToast({ message: 'Ошибка привязки: ' + error.message, type: 'error' })
      }
      return
    }
    setShowAssignModal(false)
    fetchCouriers()
  }

  const unassignZone = async (linkId: string) => {
    setUnassigningId(linkId)
    const { error } = await supabase.from('courier_zones').delete().eq('id', linkId)
    setUnassigningId(null)
    if (error) {
      setToast({ message: 'Ошибка удаления привязки: ' + error.message, type: 'error' })
      return
    }
    fetchCouriers()
  }

  const deleteCourier = async (id: string) => {
    if (!confirm('Удалить курьера?')) return
    setDeletingId(id)
    const { error } = await supabase.from('couriers').delete().eq('id', id)
    setDeletingId(null)
    if (error) {
      setToast({ message: 'Ошибка удаления курьера: ' + error.message, type: 'error' })
      return
    }
    fetchCouriers()
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
  const totalDebt = couriers.reduce((sum, c) => sum + (c.debt || 0), 0)
  const totalEarned = couriers.reduce((sum, c) => sum + (c.earned || 0), 0)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-4 md:px-8 py-5">
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">{t('staff')}</h1>
        <p className="text-sm text-gray-400 mt-0.5">Курьеры</p>
      </header>

      <main className="px-4 md:px-8 py-6 max-w-7xl mx-auto">

        {/* Адрес склада */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Warehouse size={16} className="text-gray-400" />
            <h2 className="text-sm font-bold text-gray-900">Адрес склада</h2>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              value={warehouseAddress}
              onChange={(e) => setWarehouseAddress(e.target.value)}
              placeholder="Введите адрес склада"
              className="flex-1 border rounded-lg px-3 py-2 text-sm"
            />
            <button
              onClick={saveWarehouseAddress}
              disabled={savingWarehouse}
              className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-all shrink-0"
            >
              {savingWarehouse ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
          {warehouseSaved && (
            <p className="text-xs text-green-600 font-semibold mt-2">Адрес склада сохранён</p>
          )}
          {!warehouseSaved && warehouseCoords && (
            <p className="text-xs text-gray-400 mt-2">Координаты определены и сохранены</p>
          )}
        </div>

        {/* Карточки статистики */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <p className="text-sm text-gray-500 font-medium">Активных курьеров</p>
            <p className="text-4xl font-black text-blue-600 mt-2">{activeCouriers}</p>
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

        {!loading && sellerZones.length === 0 ? (
          <div className="bg-white rounded-2xl border border-amber-200 p-8 text-center shadow-sm">
            <p className="text-sm text-gray-600 mb-4">{t('staffNoZonesMsg')}</p>
            <Link
              href="/delivery-zones"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-all"
            >
              {t('goToZonesBtn')}
            </Link>
          </div>
        ) : (
          <>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-red-600 text-white shadow-sm shadow-red-200">
            <Users size={16} />
            Курьеры ({couriers.length})
          </div>
          <button
            onClick={openAssignModal}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-all"
          >
            <Link2 size={16} />
            Привязать курьера
          </button>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400 text-sm">{t('loading')}</div>
        ) : allCouriers.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center shadow-sm">
            <p className="text-sm text-gray-500">{t('staffNoCourierPoolMsg')}</p>
          </div>
        ) : (

          /* ===== ТАБЛИЦА КУРЬЕРОВ ===== */
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Имя</th>
                  <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{t('phone')}</th>
                  <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{t('status')}</th>
                  <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Зоны</th>
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
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-1.5 items-start">
                        {c.zoneLinks.map((link) => (
                          <span
                            key={link.id}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border"
                            style={{
                              backgroundColor: link.zone_color + '1a',
                              borderColor: link.zone_color + '55',
                              color: link.zone_color,
                            }}
                          >
                            {link.zone_name}
                            <button
                              onClick={() => unassignZone(link.id)}
                              disabled={unassigningId === link.id}
                              className="hover:opacity-70 disabled:opacity-30"
                              title="Отвязать зону"
                            >
                              <X size={12} />
                            </button>
                          </span>
                        ))}
                      </div>
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
                          disabled={deletingId === c.id}
                          className="flex items-center gap-1.5 border border-red-200 text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
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
          </div>
        )}
          </>
        )}
      </main>

      {showAssignModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setShowAssignModal(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 w-[440px] max-w-[90vw] max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold text-lg mb-4">Привязать курьера к зоне</h3>

            <label className="block text-sm mb-3">
              <span className="block text-xs text-gray-500 mb-1">Курьер</span>
              <select
                value={assignCourierId}
                onChange={(e) => setAssignCourierId(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Выберите курьера</option>
                {allCouriers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name} — {c.phone}
                  </option>
                ))}
              </select>
            </label>

            {sellerZones.length === 0 ? (
              <p className="text-sm text-amber-600 font-semibold mb-3">
                Сначала нарисуйте зону на вкладке Зоны доставки
              </p>
            ) : (
              <label className="block text-sm mb-4">
                <span className="block text-xs text-gray-500 mb-1">Зона</span>
                <select
                  value={assignZoneId}
                  onChange={(e) => setAssignZoneId(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Выберите зону</option>
                  {sellerZones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowAssignModal(false)}
                className="px-4 py-2 rounded-lg border text-sm font-semibold text-gray-600 hover:bg-gray-50"
              >
                Отмена
              </button>
              <button
                onClick={assignCourierToZone}
                disabled={!assignCourierId || !assignZoneId || assigning}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-40"
              >
                {assigning ? 'Сохранение...' : 'Привязать'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
