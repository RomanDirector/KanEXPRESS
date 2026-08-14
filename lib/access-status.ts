export type AccessStatus = 'pending' | 'approved' | 'banned'

export const ACCESS_STATUS_LABEL: Record<AccessStatus, string> = {
  pending: 'Ожидает',
  approved: 'Одобрен',
  banned: 'Заблокирован',
}

export const ACCESS_STATUS_BADGE_CLASS: Record<AccessStatus, string> = {
  pending: 'text-amber-700 bg-amber-50 border-amber-200',
  approved: 'text-green-700 bg-green-50 border-green-200',
  banned: 'text-red-700 bg-red-50 border-red-200',
}
