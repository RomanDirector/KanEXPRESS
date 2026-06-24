'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import jsPDF from 'jspdf'
import JsBarcode from 'jsbarcode'

interface Order {
  id: string
  order_number: string
  client_phone: string
  client_address: string
  status: string
  created_at: string
}

function generatePDF(order: Order) {
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
  doc.text(`Status: ${order.status}`, 20, 75)
  doc.text(`Date: ${new Date(order.created_at).toLocaleDateString('ru-RU')}`, 20, 85)

  const canvas = document.createElement('canvas')
  JsBarcode(canvas, order.order_number, {
    format: 'CODE128',
    width: 2,
    height: 60,
    displayValue: true,
  })
  const barcodeImage = canvas.toDataURL('image/png')
  doc.addImage(barcodeImage, 'PNG', 20, 95, 120, 40)

  doc.line(20, 145, 190, 145)
  doc.setFontSize(9)
  doc.setTextColor(150, 150, 150)
  doc.text('KanEXpress — Logistics for Kaspi.kz sellers', 20, 152)

  doc.save(`invoice-${order.order_number}.pdf`)
}

export default function InvoicesPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error:', error.message)
      } else {
        setOrders(data as Order[])
      }
      setLoading(false)
    }

    fetchOrders()
  }, [])

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <header className="border-b border-gray-200 dark:border-gray-800 px-6 py-4 flex items-center justify-between">
        <h2 className="text-xl font-bold">Invoices</h2>
        <button
          onClick={() => orders.forEach((o) => generatePDF(o))}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          ⬇️ Download All
        </button>
      </header>

      <main className="px-6 py-6 max-w-7xl mx-auto">
        {loading ? (
          <div className="text-center py-20 text-gray-400">Loading...</div>
        ) : orders.length === 0 ? (
          <div className="text-center py-20 text-gray-400">No invoices found</div>
        ) : (
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Order #</th>
                  <th className="px-4 py-3 font-medium">Phone</th>
                  <th className="px-4 py-3 font-medium">Address</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Download</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium">{order.order_number}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{order.client_phone}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{order.client_address}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {new Date(order.created_at).toLocaleDateString('ru-RU')}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {order.status}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => generatePDF(order)}
                        className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-xs font-medium transition-colors"
                      >
                        ⬇️ PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-sm text-gray-400 mt-3">Total invoices: {orders.length}</p>
      </main>
    </div>
  )
}