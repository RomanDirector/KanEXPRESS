'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import jsPDF from 'jspdf'
import JsBarcode from 'jsbarcode'
import QRCode from 'qrcode'
import { Download } from 'lucide-react'
import { useLang } from '@/lib/i18n'

interface Order {
  id: string
  order_number: string
  client_phone: string
  client_address: string
  status: string
  price: number
  created_at: string
}

async function generatePDF(order: Order) {
  const doc = new jsPDF()

  doc.setFontSize(22)
  doc.setTextColor(220, 0, 0)
  doc.text('KanEXpress', 20, 20)
  doc.setFontSize(12)
  doc.setTextColor(0, 0, 0)
  doc.text('Invoice', 20, 30)
  doc.setDrawColor(220, 0, 0)
  doc.line(20, 35, 190, 35)

  doc.setFontSize(11)
  doc.text(`Order: ${order.order_number}`, 20, 45)
  doc.text(`Phone: ${order.client_phone}`, 20, 55)
  doc.text(`Address: ${order.client_address}`, 20, 65)
  doc.text(`Price: ${order.price} KZT`, 20, 75)
  doc.text(`Status: ${order.status}`, 20, 85)
  doc.text(`Date: ${new Date(order.created_at).toLocaleDateString('ru-RU')}`, 20, 95)

  // Штрихкод
  const canvas = document.createElement('canvas')
  JsBarcode(canvas, order.order_number, { format: 'CODE128', width: 2, height: 60, displayValue: true })
  doc.addImage(canvas.toDataURL('image/png'), 'PNG', 20, 105, 110, 35)

  // QR-код (ведёт на страницу отслеживания заказа)
  const qrDataUrl = await QRCode.toDataURL(`https://kanexpress.kz/order-tracking?order=${order.order_number}`, { width: 200 })
  doc.addImage(qrDataUrl, 'PNG', 140, 105, 40, 40)

  doc.line(20, 155, 190, 155)
  doc.setFontSize(9)
  doc.setTextColor(150, 150, 150)
  doc.text('KanEXpress — Logistics for Kaspi.kz sellers', 20, 162)

  doc.save(`invoice-${order.order_number}.pdf`)
}

// Ярлык-этикетка для наклейки на посылку (маленький формат)
async function generateLabel(order: Order) {
  const doc = new jsPDF({ format: [100, 70], orientation: 'landscape' })

  doc.setFontSize(14)
  doc.setTextColor(220, 0, 0)
  doc.text('KanEXpress', 5, 10)

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
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())

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
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, client_phone, client_address, status, price, created_at')
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false })
      if (error) console.error(error.message)
      else setOrders(data as Order[])
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
    const toDownload = selected.size > 0 ? orders.filter(o => selected.has(o.id)) : orders
    for (const order of toDownload) {
      await generatePDF(order)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-8 py-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">{t('invoices')}</h1>
          <p className="text-sm text-gray-400 mt-0.5">PDF + QR + Barcode</p>
        </div>
        <button
          onClick={downloadSelected}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-red-100"
        >
          <Download size={16} />
          {selected.size > 0 ? `${t('downloadSelected')} (${selected.size})` : t('downloadInvoices')}
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
                  <th className="px-4 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Label</th>
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
                        onClick={() => generatePDF(order)}
                        className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-lg text-xs font-semibold transition-all"
                      >
                        PDF + QR
                      </button>
                    </td>
                    <td className="px-4 py-4">
                      <button
                        onClick={() => generateLabel(order)}
                        className="border border-red-600 text-red-600 hover:bg-red-50 px-3 py-1 rounded-lg text-xs font-semibold transition-all"
                      >
                        🏷️ Ярлык
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