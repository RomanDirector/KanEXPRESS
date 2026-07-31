export interface OrderForMessage { number: string; deliveryFrom?: string; deliveryTo?: string }

function formatTime(d: Date) {
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

// Заказ обычно доставляется в течение нескольких часов после подтверждения,
// поэтому окно 2-5 часов от текущего момента — разумная оценка, когда точное время не задано явно.
export function defaultDeliveryWindow(now: Date = new Date()) {
  return {
    deliveryFrom: formatTime(new Date(now.getTime() + 2 * 60 * 60 * 1000)),
    deliveryTo: formatTime(new Date(now.getTime() + 5 * 60 * 60 * 1000)),
  }
}

export const waTemplates = {
  order_accepted: (o: OrderForMessage) => {
    const fallback = defaultDeliveryWindow()
    const deliveryFrom = o.deliveryFrom || fallback.deliveryFrom
    const deliveryTo = o.deliveryTo || fallback.deliveryTo
    return `Здравствуйте! Ваш заказ №${o.number} принят в обработку.\nДоставка будет с ${deliveryFrom} по ${deliveryTo}.\nСпасибо за покупку! 📦`
  },
  order_in_transit: (o: OrderForMessage) =>
    `Ваш заказ №${o.number} передан курьеру и уже в пути.\nОжидайте звонка перед доставкой.`,
  order_delivered: (o: OrderForMessage) =>
    `Ваш заказ №${o.number} доставлен. Спасибо за покупку! 🙏\nБудем рады вашему отзыву ⭐`,
}

export function openWhatsApp(phone: string, text: string) {
  const clean = phone.replace(/[^\d]/g, '')
  window.open(`https://wa.me/${clean}?text=${encodeURIComponent(text)}`, '_blank')
}