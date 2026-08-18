import { Resend } from 'resend'

// Серверная отправка e-mail администратору (Кайсару) — пункт 5 ТЗ.
//
// Fail-soft строго обязателен: отсутствие ключа/адреса или падение Resend НЕ
// должно ронять регистрацию, вход или любой другой флоу. Функция никогда не
// бросает исключение — только логирует и возвращает { sent: false }.
export async function sendAdminNotification({
  subject,
  html,
}: {
  subject: string
  html: string
}): Promise<{ sent: boolean }> {
  const apiKey = process.env.RESEND_API_KEY
  const to = process.env.ADMIN_NOTIFY_EMAIL

  // Нет хотя бы одной переменной — молча ничего не отправляем, пишем предупреждение в лог.
  if (!apiKey || !to) {
    console.warn(
      '[notify] RESEND_API_KEY или ADMIN_NOTIFY_EMAIL не заданы — уведомление администратору не отправлено'
    )
    return { sent: false }
  }

  try {
    const resend = new Resend(apiKey)
    const { error } = await resend.emails.send({
      from: 'KanExpress <onboarding@resend.dev>',
      to,
      subject,
      html,
    })
    if (error) {
      console.error('[notify] Resend вернул ошибку:', error)
      return { sent: false }
    }
    return { sent: true }
  } catch (err) {
    // Падение сети/SDK не должно всплывать наверх и ломать вызвавший флоу.
    console.error('[notify] отправка уведомления упала:', err)
    return { sent: false }
  }
}
