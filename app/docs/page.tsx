import type { Metadata } from 'next'
import Link from 'next/link'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'

export const metadata: Metadata = {
  title: 'Документация — KanExpress',
  description: 'Руководство по подключению и использованию KanExpress.',
}

const SIDEBAR = [
  {
    title: 'Начало работы',
    links: [
      { label: 'Быстрый старт',        href: '#quickstart', active: true },
      { label: 'Регистрация аккаунта',  href: '#register' },
      { label: 'Подключение Kaspi API', href: '#kaspi-api' },
      { label: 'Первый заказ',          href: '#first-order' },
    ],
  },
  {
    title: 'Заказы',
    links: [
      { label: 'Авто-приём заказов',   href: '#auto-orders' },
      { label: 'Назначение курьера',   href: '#assign-courier' },
      { label: 'Статусы заказа',       href: '#statuses' },
      { label: 'Возвраты',             href: '#returns' },
    ],
  },
  {
    title: 'Курьеры',
    links: [
      { label: 'Добавление курьера', href: '#add-courier' },
      { label: 'Зоны доставки',      href: '#zones' },
      { label: 'Карта маршрутов',    href: '#map' },
    ],
  },
  {
    title: 'Накладные',
    links: [
      { label: 'Печать PDF',      href: '#print-pdf' },
      { label: 'Пакетная печать', href: '#batch-print' },
      { label: 'Штрихкоды',       href: '#barcodes' },
    ],
  },
  {
    title: 'Оплата и тарифы',
    links: [
      { label: 'Тарифы',                href: '/tariffs' },
      { label: 'Как формируются счета', href: '#billing' },
      { label: 'Способы оплаты',        href: '#payment-methods' },
    ],
  },
  {
    title: 'API',
    links: [
      { label: 'Аутентификация', href: '#api-auth' },
      { label: 'Webhooks',       href: '#webhooks' },
      { label: 'Эндпоинты',      href: '#endpoints' },
    ],
  },
]

const ARTICLES = [
  { num: '01', tag: 'Старт',       time: '5 мин',   title: 'Быстрый старт',                       desc: 'Подключите магазин и получите первый заказ за 5 минут.' },
  { num: '02', tag: 'Старт',       time: '3 мин',   title: 'Получение Kaspi API-ключа',            desc: 'Пошагово: как найти ключ в личном кабинете Kaspi Merchant.' },
  { num: '03', tag: 'Заказы',      time: '7 мин',   title: 'Как работает авто-приём заказов',      desc: 'Система синхронизируется с Kaspi каждые 10 минут автоматически.' },
  { num: '04', tag: 'Курьеры',     time: '10 мин',  title: 'Настройка зон доставки на 2GIS-карте', desc: 'Рисуем полигоны и назначаем курьеров по районам.' },
  { num: '05', tag: 'Накладные',   time: '4 мин',   title: 'Пакетная печать накладных',            desc: '100 накладных за один клик — пошаговая инструкция.' },
  { num: '06', tag: 'Уведомления', time: '6 мин',   title: 'WhatsApp-уведомления клиентам',        desc: 'Автоматические сообщения на каждом этапе доставки.' },
]

const STEPS = [
  { n: 1, title: 'Зарегистрируйтесь',        body: 'Перейдите на /register и создайте аккаунт. Нужен только email и пароль — занимает меньше минуты.' },
  { n: 2, title: 'Получите API-ключ Kaspi',   body: 'Войдите в Kaspi Merchant → Настройки → API-ключи. Создайте новый ключ и скопируйте его.' },
  { n: 3, title: 'Подключите магазин',        body: 'В дашборде KanExpress: Настройки → Интеграции → Kaspi. Вставьте API-ключ и Shop ID.' },
  { n: 4, title: 'Добавьте курьера',          body: 'Команда → Добавить курьера. Введите имя и телефон. Курьер получит SMS со ссылкой на приложение.' },
  { n: 5, title: 'Первый заказ',              body: 'Когда заказ появится в списке — назначьте курьера одним кликом или настройте автораспределение.' },
]

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-[#f8f8f8]">
      <Navbar />

      {/* Header */}
      <div className="bg-white border-b border-gray-100 pt-16">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <p className="mb-2 text-xs uppercase tracking-widest text-primary">Документация</p>
          <h1 className="text-3xl font-light tracking-tight text-gray-900">Руководство KanExpress</h1>
          <p className="mt-3 max-w-lg text-gray-400 text-sm">
            Всё что нужно для подключения и работы с сервисом. От первого заказа до продвинутых настроек API.
          </p>
          <div className="mt-6 flex max-w-md items-center gap-3 rounded-full border border-gray-200 bg-[#f8f8f8] px-5 py-3">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-4 w-4 flex-shrink-0 text-gray-300">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <span className="text-sm text-gray-300">Поиск по документации...</span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex gap-12 lg:gap-16">

          {/* Sidebar */}
          <aside className="hidden w-48 flex-shrink-0 lg:block">
            <nav className="sticky top-24 space-y-7">
              {SIDEBAR.map((section) => (
                <div key={section.title}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-400">{section.title}</p>
                  <ul className="space-y-0.5">
                    {section.links.map((link) => (
                      <li key={link.label}>
                        <Link
                          href={link.href}
                          className={[
                            'block rounded-lg px-3 py-1.5 text-sm transition-colors',
                            'active' in link && link.active
                              ? 'bg-primary/8 font-medium text-primary'
                              : 'text-gray-400 hover:bg-white hover:text-gray-900',
                          ].join(' ')}
                        >
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          </aside>

          {/* Main */}
          <main className="min-w-0 flex-1">

            {/* Article cards */}
            <div className="mb-10">
              <h2 className="mb-5 text-lg font-light text-gray-900">Популярные статьи</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {ARTICLES.map((a) => (
                  <a
                    key={a.title}
                    href="#quickstart"
                    className="group rounded-2xl bg-white p-5 transition-all hover:shadow-sm"
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <span className="text-xs font-bold text-primary">{a.num}</span>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-[#f8f8f8] px-2 py-0.5 text-xs text-gray-400">{a.tag}</span>
                        <span className="text-xs text-gray-300">{a.time}</span>
                      </div>
                    </div>
                    <h3 className="mb-1 font-light text-gray-900 group-hover:text-primary transition-colors">{a.title}</h3>
                    <p className="text-sm text-gray-400 leading-relaxed">{a.desc}</p>
                  </a>
                ))}
              </div>
            </div>

            {/* Quickstart guide */}
            <div id="quickstart" className="rounded-2xl bg-white p-8">
              <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-primary">Начало работы</div>
              <h2 className="mb-2 text-2xl font-light text-gray-900">Быстрый старт за 5 минут</h2>
              <p className="mb-8 text-sm text-gray-400">Следуйте этим шагам, чтобы получить первый заказ из Kaspi.</p>

              <div className="space-y-7">
                {STEPS.map((s, i) => (
                  <div key={s.n} className="flex gap-5">
                    <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold ${i === STEPS.length - 1 ? 'bg-primary text-white' : 'bg-[#f8f8f8] text-gray-400'}`}>
                      {s.n}
                    </div>
                    <div className="pt-0.5">
                      <h3 className="mb-1.5 font-light text-gray-900">{s.title}</h3>
                      <p className="text-sm text-gray-400 leading-relaxed">{s.body}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 rounded-xl border border-primary/20 bg-primary/5 p-4">
                <p className="text-sm text-gray-600">
                  <span className="font-medium text-primary">Совет:</span> На бесплатном тарифе доступно 50 заказов в месяц — этого хватит для полноценного тестирования.
                </p>
              </div>
            </div>

            {/* Kaspi API */}
            <div id="kaspi-api" className="mt-5 rounded-2xl bg-white p-8">
              <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-primary">Интеграция</div>
              <h2 className="mb-2 text-2xl font-light text-gray-900">Подключение Kaspi Merchant API</h2>
              <p className="mb-6 text-sm text-gray-400">Для синхронизации заказов нужен API-ключ вашего магазина.</p>

              <div className="space-y-4 text-sm text-gray-500 leading-relaxed">
                {[
                  <>Войдите в <strong className="text-gray-900">Kaspi Merchant</strong> на сайте kaspi.kz/merchantcabinet</>,
                  <>Перейдите в раздел <strong className="text-gray-900">Профиль → API-ключи</strong></>,
                  <>Нажмите <strong className="text-gray-900">"Создать ключ"</strong>, дайте ему имя (например, "KanExpress")</>,
                  <>Скопируйте <strong className="text-gray-900">API Token</strong> и <strong className="text-gray-900">Shop ID</strong></>,
                  <>Вставьте оба значения в KanExpress: <strong className="text-gray-900">Настройки → Интеграции → Kaspi</strong></>,
                ].map((step, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="flex-shrink-0 font-bold text-primary">{i + 1}.</span>
                    <p>{step}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-xl bg-yellow-50 border border-yellow-100 p-4">
                <p className="text-sm text-yellow-800">
                  <span className="font-medium">Важно:</span> Храните API-ключ в тайне. Не передавайте его третьим лицам.
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-dashed border-gray-200 p-8 text-center">
              <p className="text-sm text-gray-400">Остальные разделы документации в разработке.</p>
              <p className="mt-1 text-sm text-gray-300">
                Вопросы?{' '}
                <Link href="/contacts" className="text-primary hover:underline">Напишите нам</Link>
                {' '}— ответим в течение часа.
              </p>
            </div>
          </main>
        </div>
      </div>

      <Footer />
    </div>
  )
}
