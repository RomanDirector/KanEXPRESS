import jsPDF from 'jspdf'
import JsBarcode from 'jsbarcode'
import QRCode from 'qrcode'
import { cyrillicFontBase64 } from '@/lib/fonts/cyrillic-font'
import {
  buildInvoicePlan,
  buildLabelPlan,
  type InvoiceOrder,
  type InvoiceSeller,
  type Primitive,
} from '@/lib/invoice-plan'

export type { InvoiceOrder, InvoiceSeller, Primitive } from '@/lib/invoice-plan'

const BLACK: [number, number, number] = [0, 0, 0]

const CYR_FONT_NAME = 'CyrFont'
const CYR_FONT_FILE = 'CyrFont.ttf'

// jsPDF по умолчанию не умеет кириллицу — подключаем встроенный TTF на весь документ,
// чтобы адрес/статус/лейблы печатались корректно и на накладной, и на этикетке.
function loadCyrillicFont(doc: jsPDF) {
  doc.addFileToVFS(CYR_FONT_FILE, cyrillicFontBase64)
  doc.addFont(CYR_FONT_FILE, CYR_FONT_NAME, 'normal')
  doc.setFont(CYR_FONT_NAME)
}

// Встроенный TTF идёт одним начертанием, поэтому «жирность» имитируем лёгким
// многократным перекрытием текста — этого достаточно для акцента на номере зоны.
function drawText(doc: jsPDF, p: Extract<Primitive, { kind: 'text' }>) {
  doc.setFontSize(p.fontSize)
  const c = p.color ?? BLACK
  doc.setTextColor(c[0], c[1], c[2])
  const content = p.wrap ? doc.splitTextToSize(p.text, p.wrap) : p.text
  if (p.bold) {
    const d = 0.25
    doc.text(content, p.x, p.y)
    doc.text(content, p.x + d, p.y)
    doc.text(content, p.x, p.y + d)
    doc.text(content, p.x + d, p.y + d)
  } else {
    doc.text(content, p.x, p.y)
  }
}

async function renderPlan(doc: jsPDF, plan: Primitive[]) {
  for (const p of plan) {
    if (p.kind === 'text') {
      drawText(doc, p)
    } else if (p.kind === 'line') {
      const c = p.color ?? BLACK
      doc.setDrawColor(c[0], c[1], c[2])
      doc.line(p.x1, p.y1, p.x2, p.y2)
    } else if (p.kind === 'rect') {
      const c = p.color ?? BLACK
      doc.setDrawColor(c[0], c[1], c[2])
      doc.rect(p.x, p.y, p.w, p.h)
    } else if (p.kind === 'barcode') {
      const canvas = document.createElement('canvas')
      JsBarcode(canvas, p.value, {
        format: 'CODE128',
        width: p.barWidth,
        height: p.barHeight,
        displayValue: true,
        fontSize: p.fontSize,
        margin: 0,
      })
      doc.addImage(canvas.toDataURL('image/png'), 'PNG', p.x, p.y, p.w, p.h)
    } else if (p.kind === 'qr') {
      const qrDataUrl = await QRCode.toDataURL(p.value, { width: 200 })
      doc.addImage(qrDataUrl, 'PNG', p.x, p.y, p.size, p.size)
    }
  }
}

export async function generatePDF(order: InvoiceOrder, seller: InvoiceSeller | null) {
  const doc = new jsPDF()
  loadCyrillicFont(doc)
  await renderPlan(doc, buildInvoicePlan(order, seller))
  doc.save(`invoice-${order.order_number}.pdf`)
}

// Ярлык-этикетка для наклейки на посылку (маленький формат)
export async function generateLabel(order: InvoiceOrder) {
  const doc = new jsPDF({ format: [100, 70], orientation: 'landscape' })
  loadCyrillicFont(doc)
  await renderPlan(doc, buildLabelPlan(order))
  doc.save(`label-${order.order_number}.pdf`)
}
