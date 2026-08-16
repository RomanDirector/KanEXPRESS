// Чистое, декларативное описание раскладки накладной и этикетки — БЕЗ jsPDF и DOM.
// Вынесено отдельным модулем, чтобы раскладку можно было строить и проверять
// в обычном node-скрипте (без canvas/шрифтов), а рендер жил в lib/invoice-pdf.ts.

// Данные заказа/продавца, которых достаточно для печати накладной и этикетки.
// Структурно совместимо с более широким Order на странице (лишние поля игнорируются).
export interface InvoiceOrder {
  order_number: string
  client_phone: string
  client_address: string
  created_at: string
  product_name: string | null
  zone_id: string | null
  zones: { name: string; display_number: number | null } | null
}

export interface InvoiceSeller {
  organization_name: string | null
  phone: string | null
}

export type RGB = [number, number, number]

// Один элемент PDF. План (массив таких элементов) строится чистой функцией.
export type Primitive =
  | { kind: 'text'; role?: string; text: string; x: number; y: number; fontSize: number; color?: RGB; bold?: boolean; wrap?: number }
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number; color?: RGB }
  | { kind: 'rect'; x: number; y: number; w: number; h: number; color?: RGB }
  | { kind: 'barcode'; role?: string; value: string; x: number; y: number; w: number; h: number; barWidth: number; barHeight: number; fontSize: number }
  | { kind: 'qr'; role?: string; value: string; x: number; y: number; size: number }

const RED: RGB = [220, 0, 0]
const GRAY: RGB = [120, 120, 120]
const LIGHT_GRAY: RGB = [150, 150, 150]
const BLACK: RGB = [0, 0, 0]

// Значение зоны для крупной печати: цифра display_number либо «—», если зоны/номера нет.
// (Логика данных зоны считается проверенной — трогаем только представление.)
export function zoneLabel(order: InvoiceOrder): string {
  const zoneNumber = order.zone_id ? order.zones?.display_number ?? null : null
  return zoneNumber != null ? String(zoneNumber) : '—'
}

// Накладная A4 (210×297 мм). Компоновка идёт сверху вниз без пустой середины:
// шапка+штрихкод → таблица отправитель/получатель → товар → дата → блок зоны
// (крупная цифра слева) + QR справа → футер внизу страницы.
export function buildInvoicePlan(order: InvoiceOrder, seller: InvoiceSeller | null): Primitive[] {
  const plan: Primitive[] = []

  // Шапка: логотип слева
  plan.push({ kind: 'text', role: 'brand', text: 'KanEXpress', x: 20, y: 16, fontSize: 22, color: RED })
  plan.push({ kind: 'text', role: 'subtitle', text: 'Накладная', x: 20, y: 22, fontSize: 9, color: LIGHT_GRAY })

  // Крупный штрихкод — главный элемент для сканирования на складе
  plan.push({ kind: 'barcode', role: 'barcode', value: order.order_number, x: 100, y: 4, w: 90, h: 28, barWidth: 2.4, barHeight: 70, fontSize: 22 })
  plan.push({ kind: 'line', x1: 20, y1: 34, x2: 190, y2: 34, color: RED })

  // Таблица «Отправитель / Получатель»
  const tableTop = 40
  const tableHeaderH = 8
  const tableH = 46
  const tableMidX = 105
  plan.push({ kind: 'rect', x: 20, y: tableTop, w: 170, h: tableH, color: BLACK })
  plan.push({ kind: 'line', x1: tableMidX, y1: tableTop, x2: tableMidX, y2: tableTop + tableH, color: BLACK })
  plan.push({ kind: 'line', x1: 20, y1: tableTop + tableHeaderH, x2: 190, y2: tableTop + tableHeaderH, color: BLACK })

  plan.push({ kind: 'text', role: 'senderLabel', text: 'ОТПРАВИТЕЛЬ', x: 23, y: tableTop + 5.5, fontSize: 9, color: GRAY })
  plan.push({ kind: 'text', role: 'recipientLabel', text: 'ПОЛУЧАТЕЛЬ', x: tableMidX + 3, y: tableTop + 5.5, fontSize: 9, color: GRAY })

  plan.push({ kind: 'text', role: 'senderOrg', text: seller?.organization_name || 'KanEXpress', x: 23, y: tableTop + tableHeaderH + 8, fontSize: 11, color: BLACK })
  plan.push({ kind: 'text', role: 'senderPhone', text: seller?.phone || '-', x: 23, y: tableTop + tableHeaderH + 16, fontSize: 11, color: BLACK })

  // В данных заказа нет отдельного имени клиента (только телефон/адрес) — печатаем как есть
  plan.push({ kind: 'text', role: 'recipientPhone', text: order.client_phone, x: tableMidX + 3, y: tableTop + tableHeaderH + 8, fontSize: 11, color: BLACK })
  plan.push({ kind: 'text', role: 'recipientAddress', text: order.client_address, x: tableMidX + 3, y: tableTop + tableHeaderH + 16, fontSize: 11, color: BLACK, wrap: 62 })

  // Товар (если задан) и дата — сразу под таблицей
  let y = tableTop + tableH + 12
  if (order.product_name) {
    plan.push({ kind: 'text', role: 'product', text: `Товар: ${order.product_name}`, x: 20, y, fontSize: 11, color: BLACK })
    y += 10
  }
  plan.push({ kind: 'text', role: 'date', text: `Дата: ${new Date(order.created_at).toLocaleDateString('ru-RU')}`, x: 20, y, fontSize: 11, color: BLACK })

  // Блок зоны: название мелко НАД огромной цифрой (аналог «GAP» на транспортных
  // накладных — по нему сортируют коробки). Цифра печатается всегда: число или «—».
  if (order.zones?.name) {
    plan.push({ kind: 'text', role: 'zoneName', text: order.zones.name, x: 20, y: 126, fontSize: 11, color: GRAY })
  }
  plan.push({ kind: 'text', role: 'zoneNumber', text: zoneLabel(order), x: 20, y: 158, fontSize: 48, color: RED, bold: true })

  // QR справа, на уровне блока зоны (ведёт на страницу отслеживания заказа)
  plan.push({ kind: 'qr', role: 'qr', value: `https://kanexpress.kz/order-tracking?order_number=${order.order_number}`, x: 150, y: 120, size: 42 })

  // Футер прижат к низу страницы
  const footerY = 285
  plan.push({ kind: 'line', x1: 20, y1: footerY, x2: 190, y2: footerY, color: RED })
  plan.push({ kind: 'text', role: 'footer', text: 'KanEXpress — логистика для продавцов Kaspi.kz', x: 20, y: footerY + 7, fontSize: 9, color: LIGHT_GRAY })

  return plan
}

// Этикетка 100×70 мм (landscape). Обязателен ОГРОМНЫЙ номер зоны слева внизу.
export function buildLabelPlan(order: InvoiceOrder): Primitive[] {
  const plan: Primitive[] = []

  plan.push({ kind: 'text', role: 'brand', text: 'KanEXpress', x: 3, y: 8, fontSize: 10, color: RED })

  // Штрихкод — главный элемент для сканирования
  plan.push({ kind: 'barcode', role: 'barcode', value: order.order_number, x: 30, y: 2, w: 67, h: 16, barWidth: 1.6, barHeight: 50, fontSize: 10 })

  plan.push({ kind: 'text', role: 'address', text: order.client_address, x: 3, y: 23, fontSize: 7, color: BLACK, wrap: 60 })

  if (order.product_name) {
    plan.push({ kind: 'text', role: 'product', text: `Товар: ${order.product_name}`, x: 3, y: 34, fontSize: 7, color: BLACK })
  }

  // Название зоны мелко НАД огромной цифрой
  if (order.zones?.name) {
    plan.push({ kind: 'text', role: 'zoneName', text: order.zones.name, x: 3, y: 44, fontSize: 6, color: GRAY })
  }
  plan.push({ kind: 'text', role: 'zoneNumber', text: zoneLabel(order), x: 3, y: 64, fontSize: 30, color: RED, bold: true })

  plan.push({ kind: 'qr', role: 'qr', value: order.order_number, x: 72, y: 40, size: 24 })

  return plan
}
