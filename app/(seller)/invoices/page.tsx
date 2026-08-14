'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Download } from 'lucide-react'
import { useLang } from '@/lib/i18n'
import { Toast } from '@/components/Toast'
import { generatePDF, generateLabel } from '@/lib/invoice-pdf'

interface Order {
  id: string
  order_number: string
  client_phone: string
  client_address: string
  status: string
  price: number
  created_at: string
  product_name: string | null
  zone_id: string | null
  zones: { name: string; display_number: number | null } | null
}

interface SellerInfo {
  organization_name: string | null
  phone: string | null
}

// jsPDF-текст пишется в документ, который держит в руках клиент и курьер —
// поэтому статусы и подписи здесь всегда на русском, независимо от языка интерфейса.
const STATUS_RU: Record<string, string> = {
  pending: 'Не отгружено',
  in_transit: 'В пути',
  delivered: 'Доставлено',
}

export default function InvoicesPage() {
  const { t } = useLang()
  const [orders, setOrders] = useState<Order[]>([])
  const [seller, setSeller] = useState<SellerInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [downloadingAll, setDownloadingAll] = useState(false)
  const [generatingId, setGeneratingId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null)

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true)
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }
      const [{ data, error }, { data: sellerData, error: sellerError }] = await Promise.all([
        supabase
          .from('orders')
          .select('id, order_number, client_phone, client_address, status, price, created_at, product_name, zone_id, zones ( name, display_number )')
          .eq('seller_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('sellers')
          .select('organization_name, phone')
          .eq('id', user.id)
          .maybeSingle(),
      ])
      if (error) {
        console.error(error.message)
        setToast({ message: t('loadErrorPrefix') + error.message, type: 'error' })
      } else setOrders((data || []) as unknown as Order[])
      if (sellerError) console.error(sellerError.message)
      else setSeller(sellerData as SellerInfo | null)
      setLoading(false)
    }
    fetchOrders()
  }, [])

  const toggleOne = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === orders.length) setSelected(new Set())
    else setSelected(new Set(orders.map(o => o.id)))
  }

  const downloadSelected = async () => {
    setDownloadingAll(true)
    const toDownload = selected.size > 0 ? orders.filter(o => selected.has(o.id)) : orders
    try {
      for (const order of toDownload) {
        await generatePDF(order, seller)
      }
    } catch (err) {
      console.error(err)
      setToast({ message: t('invoiceGenerateErrorMsg'), type: 'error' })
    } finally {
      setDownloadingAll(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-4 md:px-8 py-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">{t('invoices')}</h1>
          <p className="text-sm text-gray-400 mt-0.5">PDF + QR + Штрихкод</p>
        </div>
        <button
          onClick={downloadSelected}
          disabled={downloadingAll || orders.length === 0}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-red-100 disabled:opacity-50"
        >
          <Download size={16} />
          {downloadingAll
            ? t('loading')
            : selected.size > 0
            ? `${t('downloadSelected')} (${selected.size})`
            : t('downloadInvoices')}
        </button>
      </header>

      <main className="px-4 md:px-8 py-6 max-w-7xl mx-auto">
        {loading ? (
          <div className="text-center py-20 text-gray-400 text-sm">{t('loading')}</div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-4">
                    <input
                      type="checkbox"
                      checked={orders.length > 0 && selected.size === orders.length}
                      onChange={toggleAll}
                      className="w-4 h-4 accent-red-600 cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{t('orderNum')}</th>
                  <th className="px-4 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{t('phone')}</th>
                  <th className="px-4 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{t('address')}</th>
                  <th className="px-4 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{t('price')}</th>
                  <th className="px-4 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">PDF</th>
                  <th className="px-4 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{t('labelBtn')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {orders.map((order) => (
                  <tr key={order.id} className={`hover:bg-gray-50 transition-colors ${selected.has(order.id) ? 'bg-red-50' : ''}`}>
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selected.has(order.id)}
                        onChange={() => toggleOne(order.id)}
                        className="w-4 h-4 accent-red-600 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-4 font-mono font-bold text-gray-900">{order.order_number}</td>
                    <td className="px-4 py-4 text-gray-600">{order.client_phone}</td>
                    <td className="px-4 py-4 text-gray-500 max-w-[180px] truncate">{order.client_address}</td>
                    <td className="px-4 py-4 font-bold text-gray-900">{order.price?.toLocaleString('ru-RU')} ₸</td>
                    <td className="px-4 py-4">
                      <button
                        onClick={async () => {
                          setGeneratingId(order.id)
                          try {
                            await generatePDF(order, seller)
                          } catch (err) {
                            console.error(err)
                            setToast({ message: t('invoiceGenerateErrorMsg'), type: 'error' })
                          } finally {
                            setGeneratingId(null)
                          }
                        }}
                        disabled={generatingId === order.id}
                        className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                      >
                        PDF + QR
                      </button>
                    </td>
                    <td className="px-4 py-4">
                      <button
                        onClick={async () => {
                          setGeneratingId(order.id)
                          try {
                            await generateLabel(order)
                          } catch (err) {
                            console.error(err)
                            setToast({ message: t('labelGenerateErrorMsg'), type: 'error' })
                          } finally {
                            setGeneratingId(null)
                          }
                        }}
                        disabled={generatingId === order.id}
                        className="border border-red-600 text-red-600 hover:bg-red-50 px-3 py-1 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                      >
                        🏷️ {t('labelBtn')}
                      </button>
                    </td>
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