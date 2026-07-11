export interface OrderForMessage {
  number: string;
  deliveryFrom?: string;
  deliveryTo?: string;
}

export const waTemplates = {
  order_accepted: (o: OrderForMessage) =>
    `Здравствуйте! Ваш заказ №${o.number} принят в обработку.\n` +
    `Доставка будет с ${o.deliveryFrom || '—'} по ${o.deliveryTo || '—'}.\n` +
    `Спасибо за покупку! 📦`,

  order_in_transit: (o: OrderForMessage) =>
    `Ваш заказ №${o.number} передан курьеру и уже в пути.\n` +
    `Ожидайте звонка перед доставкой.`,

  order_delivered: (o: OrderForMessage) =>
    `Ваш заказ №${o.number} доставлен. Спасибо за покупку! 🙏\n` +
    `Будем рады вашему отзыву ⭐`,
};

export function openWhatsApp(phone: string, text: string) {
  const clean = phone.replace(/[^\d]/g, '');
  const url = `https://wa.me/${clean}?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}