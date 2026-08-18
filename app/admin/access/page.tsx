'use client'

import { useEffect, useState } from 'react'
import { Store, Users, Check, Ban as BanIcon, RotateCcw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { ACCESS_STATUS_LABEL, ACCESS_STATUS_BADGE_CLASS, type AccessStatus } from '@/lib/access-status'

type Kind = 'sellers' | 'couriers'

interface Row {
  id: string
  title: string
  subtitle: string
  access_status: AccessStatus
}

async function loadRows(kind: Kind): Promise<Row[]> {
  if (kind === 'sellers') {
    const { data, error } = await supabase
      .from('sellers')
      .select('id, organization_name, full_name, phone, access_status')
      .order('created_at', { ascending: false })
    if (error) {
      console.error(error)
      return []
    }
    return (data || []).map((s: any) => ({
      id: s.id,
      title: s.organization_name || s.full_name,
      subtitle: `${s.full_name} · ${s.phone}`,
      access_status: s.access_status as AccessStatus,
    }))
  }
  const { data, error } = await supabase
    .from('couriers')
    .select('id, full_name, phone, access_status')
    .order('created_at', { ascending: false })
  if (error) {
    console.error(error)
    return []
  }
  return (data || []).map((c: any) => ({
    id: c.id,
    title: c.full_name,
    subtitle: c.phone,
    access_status: c.access_status as AccessStatus,
  }))
}

export default function AdminAccessPage() {
  const [tab, setTab] = useState<Kind>('sellers')
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function reload() {
    setLoading(true)
    setRows(await loadRows(tab))
    setLoading(false)
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  async function setAccessStatus(id: string, status: AccessStatus) {
    setBusyId(id)
    const table = tab === 'sellers' ? 'sellers' : 'couriers'
    const { error } = await supabase.from(table).update({ access_status: status }).eq('id', id)
    setBusyId(null)
    if (error) {
      console.error(error)
      alert('Ошибка сохранения: ' + error.message)
      return
    }
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, access_status: status } : r)))
  }

  const pending = rows.filter((r) => r.access_status === 'pending')
  const rest = rows.filter((r) => r.access_status !== 'pending')
  const ordered = [...pending, ...rest]

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-4 md:px-8 py-5">
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Управление доступом</h1>
        <p className="text-sm text-gray-400 mt-0.5">Одобрение и блокировка продавцов и курьеров</p>
      </header>

      <main className="px-4 md:px-8 py-6 max-w-5xl mx-auto">
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setTab('sellers')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              tab === 'sellers' ? 'bg-red-600 text-white shadow-sm shadow-red-200' : 'border border-gray-200 text-gray-500 hover:bg-gray-100 bg-white'
            }`}
          >
            <Store size={16} />
            Продавцы
          </button>
          <button
            onClick={() => setTab('couriers')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              tab === 'couriers' ? 'bg-red-600 text-white shadow-sm shadow-red-200' : 'border border-gray-200 text-gray-500 hover:bg-gray-100 bg-white'
            }`}
          >
            <Users size={16} />
            Курьеры
          </button>
        </div>

        {pending.length > 0 && (
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
            <span className="flex items-center justify-center min-w-7 h-7 px-2 rounded-full bg-amber-500 text-white text-sm font-black">
              {pending.length}
            </span>
            <div>
              <p className="text-sm font-bold text-amber-800">Ожидают подтверждения</p>
              <p className="text-xs text-amber-600">
                Новые заявки на доступ — {tab === 'sellers' ? 'магазины' : 'курьеры'}. Показаны первыми в списке ниже.
              </p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-20 text-gray-400 text-sm">Загрузка...</div>
        ) : ordered.length === 0 ? (
          <div className="text-center py-20 text-gray-400 text-sm">Список пуст</div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm divide-y divide-gray-50">
            {ordered.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div>
                  <p className="font-bold text-gray-900">{r.title}</p>
                  <p className="text-xs text-gray-400">{r.subtitle}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${ACCESS_STATUS_BADGE_CLASS[r.access_status]}`}>
                    {ACCESS_STATUS_LABEL[r.access_status]}
                  </span>
                  {r.access_status === 'pending' && (
                    <button
                      onClick={() => setAccessStatus(r.id, 'approved')}
                      disabled={busyId === r.id}
                      className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                    >
                      <Check size={13} />
                      Одобрить
                    </button>
                  )}
                  {r.access_status === 'approved' && (
                    <button
                      onClick={() => setAccessStatus(r.id, 'banned')}
                      disabled={busyId === r.id}
                      className="flex items-center gap-1.5 border border-red-200 text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                    >
                      <BanIcon size={13} />
                      Заблокировать
                    </button>
                  )}
                  {r.access_status === 'banned' && (
                    <button
                      onClick={() => setAccessStatus(r.id, 'approved')}
                      disabled={busyId === r.id}
                      className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                    >
                      <RotateCcw size={13} />
                      Разблокировать
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
