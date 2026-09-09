// Границы дня для фильтров "Стартовая/Конечная дата" — считаем в часовом
// поясе Алматы (UTC+5, Казахстан не переходит на летнее время), а не в UTC.
// created_at хранится в UTC; наивный `new Date('2026-08-26')` даёт UTC-полночь,
// которая на 5 часов раньше полуночи в Алматы — из-за этого при наивном расчёте
// конец дня "26 августа" на самом деле доходил до 04:59 утра 27-го по местному
// времени (см. баг на app/(seller)/dashboard/page.tsx). Здесь та же логика,
// вынесенная в общее место, чтобы не разъезжалась по копиям в разных файлах.

const KZ_UTC_OFFSET = '+05:00'

export function dayStartMs(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00${KZ_UTC_OFFSET}`).getTime()
}

export function dayEndMs(dateStr: string): number {
  return new Date(`${dateStr}T23:59:59.999${KZ_UTC_OFFSET}`).getTime()
}

// "Сегодня" в Алматы (UTC+5, без перехода на летнее время) — просто сдвигаем
// текущий UTC-момент на +5ч и берём календарную дату: это даёт корректный
// локальный день на любой момент суток без библиотек часовых поясов.
export function todayInAlmaty(): string {
  return new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

// Применяет диапазон дат к Supabase-запросу по колонке created_at. Пустая
// строка ('') для from/to означает "без границы" — совпадает с поведением
// пустого значения <input type="date">.
export function applyDateRange<T extends { gte: any; lte: any }>(
  query: T,
  from: string,
  to: string,
  column = 'created_at'
): T {
  let q = query
  if (from) q = q.gte(column, new Date(dayStartMs(from)).toISOString())
  if (to) q = q.lte(column, new Date(dayEndMs(to)).toISOString())
  return q
}
