'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type ReturnStatus = 'new' | 'in_progress' | 'resolved' | 'rejected'

interface ReturnRow {
  id: string
  reason: string
  status: ReturnStatus
  created_at: string
  resolved_at: string | null
  orders: { order_number: string } | null
  sellers: { organization_name: string | null } | null
}

const STATUS_LABEL: Record<ReturnStatus, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  resolved: 'Решена',
  rejected: 'Отклонена',
}
const STATUS_CLASS: Record<ReturnStatus, string> = {
  new: 'text-amber-700 bg-amber-50 border-amber-200',
  in_progress: 'text-blue-700 bg-blue-50 border-blue-200',
  resolved: 'text-green-700 bg-green-50 border-green-200',
  rejected: 'text-gray-500 bg-gray-50 border-gray-200',
}

export default function AdminReturnsPage() {
  const [rows, setRows] = useState<ReturnRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('return_requests')
      .select('id, reason, status, created_at, resolved_at, orders(order_number), sellers(organization_name)')
      .order('created_at', { ascending: false })
    if (error) console.error(error)
    setRows((data || []) as unknown as ReturnRow[])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function setStatus(id: string, status: ReturnStatus) {
    setBusyId(id)
    const patch: { status: ReturnStatus; resolved_at?: string } = { status }
    if (status === 'resolved' || status === 'rejected') patch.resolved_at = new Date().toISOString()
    const { error } = await supabase.from('return_requests').update(patch).eq('id', id)
    setBusyId(null)
    if (error) {
      console.error(error)
      alert('Ошибка сохранения: ' + error.message)
      return
    }
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } as ReturnRow : r)))
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-4 md:px-8 py-5">
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Заявки на возврат</h1>
        <p className="text-sm text-gray-400 mt-0.5">Все продавцы</p>
      </header>

      <main className="px-4 md:px-8 py-6 max-w-6xl mx-auto">
        {loading ? (
          <div className="text-center py-20 text-gray-400 text-sm">Загрузка...</div>
        ) : rows.length === 0 ? (
          <div className="text-center py-20 text-gray-400 text-sm">Заявок нет</div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Заказ</th>
                    <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Продавец</th>
                    <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Причина</th>
                    <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Статус</th>
                    <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Создана</th>
                    <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rows.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-4 font-mono font-bold text-gray-900">{r.orders?.order_number || '—'}</td>
                      <td className="px-5 py-4 text-gray-600">{r.sellers?.organization_name || '—'}</td>
                      <td className="px-5 py-4 text-gray-600 max-w-[260px] truncate">{r.reason}</td>
                      <td className="px-5 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${STATUS_CLASS[r.status]}`}>
                          {STATUS_LABEL[r.status]}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-gray-400 text-xs">{new Date(r.created_at).toLocaleString('ru-RU')}</td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          {r.status === 'new' && (
                            <button
                              onClick={() => setStatus(r.id, 'in_progress')}
                              disabled={busyId === r.id}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                            >
                              В работу
                            </button>
                          )}
                          {r.status === 'in_progress' && (
                            <>
                              <button
                                onClick={() => setStatus(r.id, 'resolved')}
                                disabled={busyId === r.id}
                                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                              >
                                Решить
                              </button>
                              <button
                                onClick={() => setStatus(r.id, 'rejected')}
                                disabled={busyId === r.id}
                                className="border border-red-200 text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                              >
                                Отклонить
                              </button>
                            </>
                          )}
                          {(r.status === 'resolved' || r.status === 'rejected') && (
                            <span className="text-xs text-gray-400">
                              Закрыта {r.resolved_at ? new Date(r.resolved_at).toLocaleDateString('ru-RU') : ''}
                            </span>
                          )}
                        </div>
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
