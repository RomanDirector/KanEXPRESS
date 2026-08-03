'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import jsPDF from 'jspdf'
import JsBarcode from 'jsbarcode'
import QRCode from 'qrcode'
import { Download } from 'lucide-react'
import { useLang } from '@/lib/i18n'
import { Toast } from '@/components/Toast'

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
  zones: { name: string } | null
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

async function generatePDF(order: Order, seller: SellerInfo | null) {
  const doc = new jsPDF()

  doc.setFontSize(22)
  doc.setTextColor(220, 0, 0)
  doc.text('KanEXpress', 20, 20)
  doc.setFontSize(12)
  doc.setTextColor(0, 0, 0)
  doc.text('Накладная', 20, 30)

  if (order.zone_id && order.zones?.name) {
    doc.setFontSize(28)
    doc.setTextColor(220, 0, 0)
    doc.text(order.zones.name, 190, 22, { align: 'right' })
  }

  doc.setDrawColor(220, 0, 0)
  doc.line(20, 35, 190, 35)

  // Таблица "Отправитель / Получатель" (как в накладной у конкурента)
  const tableTop = 42
  const tableHeaderH = 8
  const tableH = 46
  const tableMidX = 105
  doc.setDrawColor(0, 0, 0)
  doc.rect(20, tableTop, 170, tableH)
  doc.line(tableMidX, tableTop, tableMidX, tableTop + tableH)
  doc.line(20, tableTop + tableHeaderH, 190, tableTop + tableHeaderH)

  doc.setFontSize(9)
  doc.setTextColor(120, 120, 120)
  doc.text('ОТПРАВИТЕЛЬ', 23, tableTop + 5.5)
  doc.text('ПОЛУЧАТЕЛЬ', tableMidX + 3, tableTop + 5.5)

  doc.setFontSize(11)
  doc.setTextColor(0, 0, 0)
  doc.text(seller?.organization_name || 'KanEXpress', 23, tableTop + tableHeaderH + 8)
  doc.text(seller?.phone || '-', 23, tableTop + tableHeaderH + 16)

  doc.text(order.client_phone, tableMidX + 3, tableTop + tableHeaderH + 8)
  const addressLines = doc.splitTextToSize(order.client_address, 62)
  doc.text(addressLines, tableMidX + 3, tableTop + tableHeaderH + 16)

  let y = tableTop + tableH + 12
  doc.setFontSize(11)
  doc.text(`Заказ: ${order.order_number}`, 20, y); y += 10
  doc.text(`Цена: ${order.price} ₸`, 20, y); y += 10
  doc.text(`Статус: ${STATUS_RU[order.status] ?? order.status}`, 20, y); y += 10
  doc.text(`Дата: ${new Date(order.created_at).toLocaleDateString('ru-RU')}`, 20, y); y += 10

  if (order.product_name) {
    doc.text(order.product_name, 20, y)
    y += 10
  }

  // Штрихкод
  const canvas = document.createElement('canvas')
  JsBarcode(canvas, order.order_number, { format: 'CODE128', width: 2, height: 60, displayValue: true })
  doc.addImage(canvas.toDataURL('image/png'), 'PNG', 20, y, 110, 35)

  // QR-код (ведёт на страницу отслеживания заказа)
  const qrDataUrl = await QRCode.toDataURL(`https://kanexpress.kz/order-tracking?order_number=${order.order_number}`, { width: 200 })
  doc.addImage(qrDataUrl, 'PNG', 140, y, 40, 40)

  y += 45
  doc.line(20, y, 190, y)
  doc.setFontSize(9)
  doc.setTextColor(150, 150, 150)
  doc.text('KanEXpress — логистика для продавцов Kaspi.kz', 20, y + 7)

  doc.save(`invoice-${order.order_number}.pdf`)
}

// Ярлык-этикетка для наклейки на посылку (маленький формат)
async function generateLabel(order: Order) {
  const doc = new jsPDF({ format: [100, 70], orientation: 'landscape' })

  doc.setFontSize(14)
  doc.setTextColor(220, 0, 0)
  doc.text('KanEXpress', 5, 10)

  if (order.zone_id && order.zones?.name) {
    doc.setFontSize(18)
    doc.setTextColor(220, 0, 0)
    doc.text(order.zones.name, 95, 10, { align: 'right' })
  }

  doc.setFontSize(10)
  doc.setTextColor(0, 0, 0)
  doc.text(`${order.order_number}`, 5, 18)
  doc.text(`${order.client_phone}`, 5, 25)

  const canvas = document.createElement('canvas')
  JsBarcode(canvas, order.order_number, { format: 'CODE128', width: 2, height: 40, displayValue: false })
  doc.addImage(canvas.toDataURL('image/png'), 'PNG', 5, 30, 60, 20)

  const qrDataUrl = await QRCode.toDataURL(order.order_number, { width: 100 })
  doc.addImage(qrDataUrl, 'PNG', 70, 25, 25, 25)

  doc.save(`label-${order.order_number}.pdf`)
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
          .select('id, order_number, client_phone, client_address, status, price, created_at, product_name, zone_id, zones ( name )')
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
      <header className="bg-white border-b border-gray-100 px-8 py-5 flex items-center justify-between">
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

      <main className="px-8 py-6 max-w-7xl mx-auto">
        {loading ? (
          <div className="text-center py-20 text-gray-400 text-sm">{t('loading')}</div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
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
        )}
      </main>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}