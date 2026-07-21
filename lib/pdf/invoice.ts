import { jsPDF } from 'jspdf'
import JSZip from 'jszip'
import { PDFDocument } from 'pdf-lib'
import JsBarcode from 'jsbarcode'
import { cyrillicFontBase64 } from '@/lib/fonts/cyrillic-font'

export interface InvoiceOrder { number: string; client_phone: string; client_address: string; comment?: string | null }

const FONT_NAME = 'CyrFont'
const FONT_FILE = 'CyrFont.ttf'

function createDoc(): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  doc.addFileToVFS(FONT_FILE, cyrillicFontBase64)
  doc.addFont(FONT_FILE, FONT_NAME, 'normal')
  doc.setFont(FONT_NAME)
  return doc
}

function barcodeDataUrl(text: string): string {
  const canvas = document.createElement('canvas')
  JsBarcode(canvas, text, { format: 'CODE128', displayValue: false, height: 50, margin: 0 })
  return canvas.toDataURL('image/png')
}

export function generateInvoicePdf(order: InvoiceOrder): Uint8Array {
  const doc = createDoc()
  doc.setFontSize(20)
  doc.text('НАКЛАДНАЯ', 105, 20, { align: 'center' })
  doc.setFontSize(14)
  doc.text(`Заказ № ${order.number}`, 105, 32, { align: 'center' })

  try {
    const barcode = barcodeDataUrl(order.number)
    doc.addImage(barcode, 'PNG', 60, 38, 90, 20)
  } catch (e) { console.error('Barcode error:', e) }

  doc.setFontSize(12)
  let y = 70
  const line = (label: string, value: string) => {
    doc.setFont(FONT_NAME, 'normal')
    doc.text(`${label}:`, 20, y)
    const wrapped = doc.splitTextToSize(value || '—', 130)
    doc.text(wrapped, 60, y)
    y += wrapped.length * 7 + 3
  }
  line('Телефон', order.client_phone)
  line('Адрес', order.client_address)
  line('Комментарий', order.comment || 'Не указано')

  doc.setFontSize(10)
  doc.setTextColor(130)
  doc.text('KanEXpress — доставка Kaspi-заказов', 105, 285, { align: 'center' })

  return new Uint8Array(doc.output('arraybuffer'))
}

export async function generateInvoicesZip(orders: InvoiceOrder[]): Promise<Blob> {
  const zip = new JSZip()
  orders.forEach((order, i) => {
    const index = String(i + 1).padStart(2, '0')
    const safeNumber = order.number.replace(/[^\w\-]/g, '_')
    zip.file(`${index}_${safeNumber}.pdf`, generateInvoicePdf(order))
  })
  return zip.generateAsync({ type: 'blob' })
}

export async function generateMergedPdf(orders: InvoiceOrder[]): Promise<Blob> {
  const merged = await PDFDocument.create()
  for (const order of orders) {
    const single = await PDFDocument.load(generateInvoicePdf(order))
    const pages = await merged.copyPages(single, single.getPageIndices())
    pages.forEach((p) => merged.addPage(p))
  }
  const bytes = await merged.save()
  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}