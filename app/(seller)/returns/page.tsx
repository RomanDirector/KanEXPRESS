'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { RotateCcw } from 'lucide-react'
import { useLang } from '@/lib/i18n'
import { Toast } from '@/components/Toast'

type ReturnStatus = 'new' | 'in_progress' | 'resolved' | 'rejected'

interface ReturnRow {
  id: string
  reason: string
  status: ReturnStatus
  created_at: string
  orders: { order_number: string } | null
}

const STATUS_CLASS: Record<ReturnStatus, string> = {
  new: 'text-amber-700 bg-amber-50 border-amber-200',
  in_progress: 'text-blue-700 bg-blue-50 border-blue-200',
  resolved: 'text-green-700 bg-green-50 border-green-200',
  rejected: 'text-gray-500 bg-gray-50 border-gray-200',
}

export default function ReturnsPage() {
  const { t } = useLang()
  const [rows, setRows] = useState<ReturnRow[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null)

  const STATUS_LABEL: Record<ReturnStatus, string> = {
    new: t('returnStatusNew'),
    in_progress: t('returnStatusInProgress'),
    resolved: t('returnStatusResolved'),
    rejected: t('returnStatusRejected'),
  }

  useEffect(() => {
    async function load() {
      setLoading(true)
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }
      const { data, error } = await supabase
        .from('return_requests')
        .select('id, reason, status, created_at, orders(order_number)')
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false })
      if (error) {
        console.error(error.message)
        setToast({ message: t('loadErrorPrefix') + error.message, type: 'error' })
      } else setRows((data || []) as unknown as ReturnRow[])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-4 md:px-8 py-5">
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">{t('returns')}</h1>
        <p className="text-sm text-gray-400 mt-0.5">{t('returnsPageSub')}</p>
      </header>

      <main className="px-4 md:px-8 py-6 max-w-7xl mx-auto">
        {loading ? (
          <div className="text-center py-20 text-gray-400 text-sm">{t('loading')}</div>
        ) : rows.length === 0 ? (
          <div className="text-center py-20">
            <RotateCcw size={40} className="text-gray-200 mx-auto mb-4" />
            <p className="text-gray-400 text-sm">{t('notFound')}</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{t('orderNum')}</th>
                    <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{t('returnReasonHeader')}</th>
                    <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{t('returnStatusHeader')}</th>
                    <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{t('returnCreatedHeader')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rows.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-4 font-mono font-bold text-gray-900">{r.orders?.order_number || '—'}</td>
                      <td className="px-5 py-4 text-gray-600 max-w-[300px] truncate">{r.reason}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${STATUS_CLASS[r.status]}`}>
                          {STATUS_LABEL[r.status]}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-gray-400 text-xs">{new Date(r.created_at).toLocaleString('ru-RU')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
