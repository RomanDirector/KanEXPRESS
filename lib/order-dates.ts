// Дата поступления (created_at) и плановая дата доставки Kaspi
// (planned_delivery_date) сравниваются по тому же форматированному виду,
// что уходит в UI — не по сырым timestamp'ам, которые почти всегда
// отличаются на несколько часов даже для "одного и того же дня".
export function formatOrderDates(
  createdAt: string,
  plannedDeliveryDate: string | null | undefined,
  locale: string,
): { createdLabel: string; plannedLabel: string | null } {
  const createdLabel = new Date(createdAt).toLocaleDateString(locale)
  if (!plannedDeliveryDate) return { createdLabel, plannedLabel: null }

  const plannedLabel = new Date(plannedDeliveryDate).toLocaleDateString(locale)
  return { createdLabel, plannedLabel: plannedLabel === createdLabel ? null : plannedLabel }
}
