import Link from 'next/link'

export function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-gray-50 py-14">
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-3">
            <Link href="/" className="text-xl font-black tracking-tighter text-gray-900">
              Kan<span className="text-primary">EXPRESS</span>
            </Link>
            <p className="text-sm text-gray-500 leading-relaxed">
              Логистика для продавцов Kaspi.kz — быстро, прозрачно, без лишних звонков.
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Карта сайта</p>
            <ul className="space-y-2">
              {[
                { href: '/', label: 'Главная' },
                { href: '/tariffs', label: 'Тарифы' },
                { href: '/about', label: 'О нас' },
                { href: '/contacts', label: 'Контакты' },
              ].map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Документация</p>
            <ul className="space-y-2">
              {[
                { href: '/docs', label: 'Руководство' },
                { href: '/docs/api', label: 'API Kaspi' },
                { href: '/docs/courier', label: 'Для курьеров' },
                { href: '/docs/faq', label: 'FAQ' },
              ].map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Контакты</p>
            <ul className="space-y-2 text-sm text-gray-500">
              <li>Алматы, Казахстан</li>
              <li>
                <a href="mailto:hello@kanexpress.kz" className="hover:text-gray-900 transition-colors">
                  hello@kanexpress.kz
                </a>
              </li>
              <li>
                <a href="https://wa.me/77000000000" className="hover:text-gray-900 transition-colors">
                  WhatsApp
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-gray-200 pt-6 sm:flex-row">
          <p className="text-xs text-gray-400">© 2025 KanExpress. Все права защищены.</p>
          <div className="flex gap-4">
            <Link href="/contacts" className="text-xs text-gray-400 hover:text-gray-900 transition-colors">
              Политика конфиденциальности
            </Link>
            <Link href="/contacts" className="text-xs text-gray-400 hover:text-gray-900 transition-colors">
              Условия использования
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
