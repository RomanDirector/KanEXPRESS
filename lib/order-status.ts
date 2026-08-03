export type DisplayStage =
  | 'not_started' | 'dropped' | 'departed' | 'arrived'
  | 'delivered' | 'returned' | 'cancelled'

export function getDisplayStage(order: { status: string; courier_stage: string | null }): DisplayStage {
  const stage = (order.courier_stage ?? 'not_started') as DisplayStage
  if (stage === 'not_started' && order.status === 'in_transit') return 'dropped'
  return stage
}

export const STAGE_LABEL: Record<DisplayStage, string> = {
  not_started: 'Не отгружено',
  dropped: 'Отгружено',
  departed: 'Выехал',
  arrived: 'На месте',
  delivered: 'Доставлено',
  returned: 'Возврат',
  cancelled: 'Отменено',
}

export const STAGE_BADGE_CLASS: Record<DisplayStage, string> = {
  not_started: 'text-gray-600 bg-gray-50 border-gray-200',
  dropped: 'text-yellow-700 bg-yellow-50 border-yellow-200',
  departed: 'text-blue-700 bg-blue-50 border-blue-200',
  arrived: 'text-orange-700 bg-orange-50 border-orange-200',
  delivered: 'text-green-700 bg-green-50 border-green-200',
  returned: 'text-red-700 bg-red-50 border-red-200',
  cancelled: 'text-red-700 bg-red-50 border-red-200',
}

export const STAGE_MARKER_COLOR: Record<DisplayStage, string> = {
  not_started: '#9ca3af',
  dropped: '#eab308',
  departed: '#3b82f6',
  arrived: '#f97316',
  delivered: '#22c55e',
  returned: '#ef4444',
  cancelled: '#ef4444',
}
