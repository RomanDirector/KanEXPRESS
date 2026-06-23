import Link from 'next/link'

export function Footer() {
  return (
    <footer className="border-t border-white/5 bg-dark py-12">
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-3">
            <Link href="/" className="text-xl font-black tracking-tighter text-white">
              Kan<span className="text-primary">EXPRESS</span>
            </Link>
            <p className="text-sm text-white/40 leading-relaxed">
              Логистика для продавцов Kaspi.kz — быстро, прозрачно, без лишних звонков.
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/30">Продукт</p>
            <ul className="space-y-2">
              {[
                { href: '/#features', label: 'Возможности' },
                { href: '/#how', label: 'Как работает' },
                { href: '/#pricing', label: 'Тарифы' },
              ].map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-white/50 hover:text-white transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/30">Роли</p>
            <ul className="space-y-2">
              {['Продавец', 'Курьер', 'Склад', 'Администратор'].map((r) => (
                <li key={r}>
                  <span className="text-sm text-white/50">{r}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/30">Контакты</p>
            <ul className="space-y-2 text-sm text-white/50">
              <li>Алматы, Казахстан</li>
              <li>
                <a href="mailto:hello@kanexpress.kz" className="hover:text-white transition-colors">
                  hello@kanexpress.kz
                </a>
              </li>
              <li>
                <a href="https://wa.me/77000000000" className="hover:text-white transition-colors">
                  WhatsApp
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-white/5 pt-6 sm:flex-row">
          <p className="text-xs text-white/20">© 2025 KanExpress. Все права защищены.</p>
          <Link href="/contacts" className="text-xs text-white/30 hover:text-white transition-colors">
            Политика конфиденциальности
          </Link>
        </div>
      </div>
    </footer>
  )
}
