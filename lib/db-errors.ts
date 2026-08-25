// Человекочитаемые сообщения об ошибках записи в БД вместо сырого текста
// Postgres/PostgREST. Раньше в админских экранах (зоны, ящики) в alert()/Toast
// падала техническая строка вроде «new row violates row-level security policy
// for table "zones"», непонятная оператору. Здесь она переводится в понятный
// текст, а точная причина по-прежнему уходит в console.error на месте вызова.

interface DbErrorLike {
  code?: string | null
  message?: string | null
}

export function friendlyDbError(
  error: DbErrorLike | null | undefined,
  fallback = 'Не удалось сохранить изменения, попробуйте ещё раз',
): string {
  if (!error) return fallback
  const code = error.code ?? ''
  const msg = error.message ?? ''

  // RLS: у текущего пользователя нет прав на операцию (например, сессия не
  // админская). Postgres код 42501 / текст про row-level security policy.
  if (code === '42501' || /row-level security/i.test(msg)) {
    return 'Недостаточно прав для этого действия. Проверьте, что вы вошли как администратор, и попробуйте снова.'
  }
  // Нарушение уникальности (в т.ч. номер зоны через триггер с errcode 23505).
  if (code === '23505') return 'Такое значение уже занято другой записью.'
  // Внешний ключ — ссылка на несуществующую запись.
  if (code === '23503') return 'Связанная запись не найдена. Обновите страницу и попробуйте снова.'
  // NOT NULL — не заполнено обязательное поле.
  if (code === '23502') return 'Заполнены не все обязательные поля.'

  return fallback
}
