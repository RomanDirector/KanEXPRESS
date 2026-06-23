import type { Metadata } from 'next'
import Link from 'next/link'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'

export const metadata: Metadata = {
  title: 'KanExpress — Логистика для продавцов Kaspi.kz',
  description: 'Автоматизируйте доставку заказов с Kaspi. Накладные, карта курьера, аналитика — всё в одном месте.',
}

const FEATURES = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
      </svg>
    ),
    title: 'Авто-приём заказов',
    desc: 'Kaspi Merchant API синхронизирует заказы каждые 10 минут. Никаких ручных переносов.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
      </svg>
    ),
    title: 'Накладные со штрихкодом',
    desc: 'PDF одним кликом. Печатайте пакетом — хоть 100 накладных сразу.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.159.69.159 1.006 0Z" />
      </svg>
    ),
    title: 'Карта и зоны',
    desc: '2GIS-интеграция. Курьер видит свой район и оптимальный маршрут.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
      </svg>
    ),
    title: 'Аналитика в реальном времени',
    desc: 'Сколько доставлено, сколько в пути, возвраты — всё на одном экране.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
      </svg>
    ),
    title: 'WhatsApp-уведомления',
    desc: 'Покупатель получает статус заказа автоматически — без вашего участия.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 2.625c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125m16.5 2.625c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
      </svg>
    ),
    title: 'Архив и история',
    desc: 'pg_cron архивирует старые заказы еженедельно. Данные за любой период.',
  },
]

const STEPS = [
  { n: '01', title: 'Подключите Kaspi', desc: 'Вставьте API-ключ магазина — заказы начнут приходить автоматически.' },
  { n: '02', title: 'Назначьте курьера', desc: 'Система предложит ближайшего курьера по зонам. Или назначьте вручную.' },
  { n: '03', title: 'Отслеживайте онлайн', desc: 'Продавец, склад и курьер видят статус заказа в реальном времени.' },
]

const ROLES = [
  {
    label: 'Продавец',
    color: 'border-primary/40 hover:border-primary',
    desc: 'Видит все заказы, скачивает накладные пакетом, смотрит статистику и архив.',
    points: ['Заказы из Kaspi в реальном времени', 'PDF-накладные со штрихкодом', 'Фильтры по дате и статусу', 'Финансовая статистика'],
  },
  {
    label: 'Курьер',
    color: 'border-white/10 hover:border-white/30',
    desc: 'Карта с точками доставки, оптимальный маршрут, кнопка возврата.',
    points: ['2GIS-карта с маршрутами', 'Фильтр по своему району', 'Статус каждого заказа', 'История доставок'],
  },
  {
    label: 'Склад',
    color: 'border-white/10 hover:border-white/30',
    desc: 'Приёмка посылок, сканирование штрихкода, подтверждение и печать.',
    points: ['Сканер штрихкода', 'Печать накладных', 'Подтверждение приёмки', 'Очередь отгрузки'],
  },
  {
    label: 'Администратор',
    color: 'border-white/10 hover:border-white/30',
    desc: 'Рисует зоны на карте, распределяет курьеров, использует AI-оптимизацию.',
    points: ['Полигоны зон на 2GIS', 'AI-распределение курьеров', 'Сводная аналитика', 'Управление командой'],
  },
]

const PLANS = [
  {
    name: 'Старт',
    price: 'Бесплатно',
    sub: 'навсегда',
    cta: 'Начать бесплатно',
    ctaHref: '/register',
    highlight: false,
    features: ['До 50 заказов / мес', '1 курьер', 'Накладные PDF', 'Email-поддержка'],
  },
  {
    name: 'Бизнес',
    price: '9 900 ₸',
    sub: 'в месяц',
    cta: 'Попробовать 14 дней',
    ctaHref: '/register',
    highlight: true,
    features: ['Неограниченно заказов', 'До 10 курьеров', 'WhatsApp-уведомления', '2GIS-карта', 'Аналитика', 'Приоритетная поддержка'],
  },
  {
    name: 'Корпоративный',
    price: 'По запросу',
    sub: 'индивидуально',
    cta: 'Связаться',
    ctaHref: '/contacts',
    highlight: false,
    features: ['Неограниченно всего', 'SLA 99.9%', 'AI-распределение', 'Интеграции под ключ', 'Выделенный менеджер'],
  },
]

export default function HomePage() {
  return (
    <div className="min-h-screen bg-dark text-white">
      <Navbar />

      {/* ── HERO ── */}
      <section className="relative flex min-h-screen items-center overflow-hidden pt-16">
        <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[600px] w-[600px] rounded-full bg-primary/8 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute bottom-0 right-0 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />

        <div className="mx-auto max-w-6xl px-4 py-24 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            Интеграция с Kaspi Merchant API
          </div>

          <h1 className="mx-auto max-w-3xl text-5xl font-black leading-tight tracking-tight sm:text-6xl lg:text-7xl">
            Логистика для{' '}
            <span className="text-primary">продавцов</span>{' '}
            Kaspi.kz
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-lg text-white/50 leading-relaxed">
            Автоматизируйте доставку заказов — от Kaspi до двери покупателя. Накладные, карта курьера, WhatsApp-статусы.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/register"
              className="rounded-xl bg-primary px-8 py-4 text-base font-bold text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 hover:shadow-primary/40 active:scale-95"
            >
              Начать бесплатно
            </Link>
            <Link
              href="/#how"
              className="rounded-xl border border-white/10 bg-white/5 px-8 py-4 text-base font-medium text-white/70 transition-all hover:bg-white/10 hover:text-white"
            >
              Как это работает →
            </Link>
          </div>

          {/* Stats bar */}
          <div className="mx-auto mt-20 grid max-w-2xl grid-cols-3 gap-px overflow-hidden rounded-2xl border border-white/5 bg-white/5">
            {[
              { n: '500+', label: 'продавцов' },
              { n: '12 000', label: 'заказов в день' },
              { n: '98%', label: 'доставлено вовремя' },
            ].map((s) => (
              <div key={s.label} className="bg-dark/60 px-6 py-5 text-center">
                <div className="text-2xl font-black text-white">{s.n}</div>
                <div className="mt-0.5 text-xs text-white/30">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="py-24 border-t border-white/5">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-16 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">Возможности</p>
            <h2 className="text-4xl font-black tracking-tight">Всё что нужно для доставки</h2>
            <p className="mt-4 text-white/40 max-w-md mx-auto">Один сервис заменяет таблицы, звонки и ручную сортировку накладных.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-white/5 bg-white/3 p-6 transition-all hover:border-white/10 hover:bg-white/5"
              >
                <div className="mb-4 inline-flex rounded-xl bg-primary/10 p-3 text-primary">
                  {f.icon}
                </div>
                <h3 className="mb-2 font-semibold text-white">{f.title}</h3>
                <p className="text-sm text-white/40 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how" className="py-24 border-t border-white/5">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-16 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">Как работает</p>
            <h2 className="text-4xl font-black tracking-tight">Три шага до первой доставки</h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-2xl border border-white/5 bg-white/3 p-6">
                <span className="mb-4 block text-5xl font-black text-primary/20">{s.n}</span>
                <h3 className="mb-2 font-semibold text-white">{s.title}</h3>
                <p className="text-sm text-white/40 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ROLES ── */}
      <section className="py-24 border-t border-white/5">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-16 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">Роли</p>
            <h2 className="text-4xl font-black tracking-tight">Каждый видит своё</h2>
            <p className="mt-4 text-white/40 max-w-md mx-auto">Один логин — правильный интерфейс в зависимости от роли в команде.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {ROLES.map((r) => (
              <div key={r.label} className={`rounded-2xl border bg-white/3 p-6 transition-all ${r.color}`}>
                <div className="mb-1 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  <h3 className="font-bold text-white">{r.label}</h3>
                </div>
                <p className="mb-4 text-sm text-white/40">{r.desc}</p>
                <ul className="space-y-1.5">
                  {r.points.map((p) => (
                    <li key={p} className="flex items-center gap-2 text-sm text-white/60">
                      <svg className="w-3.5 h-3.5 text-primary flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="py-24 border-t border-white/5">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-16 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">Тарифы</p>
            <h2 className="text-4xl font-black tracking-tight">Простые цены</h2>
            <p className="mt-4 text-white/40">Начните бесплатно — платите когда вырастете.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {PLANS.map((p) => (
              <div
                key={p.name}
                className={[
                  'relative flex flex-col rounded-2xl border p-6 transition-all',
                  p.highlight
                    ? 'border-primary bg-primary/5 shadow-xl shadow-primary/10'
                    : 'border-white/5 bg-white/3',
                ].join(' ')}
              >
                {p.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-bold text-white">
                    Популярный
                  </div>
                )}
                <div className="mb-6">
                  <p className="text-sm font-semibold text-white/40">{p.name}</p>
                  <p className="mt-1 text-3xl font-black text-white">{p.price}</p>
                  <p className="text-xs text-white/30">{p.sub}</p>
                </div>
                <ul className="mb-8 flex-1 space-y-2.5">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-white/60">
                      <svg className="w-3.5 h-3.5 text-primary flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={p.ctaHref}
                  className={[
                    'rounded-xl py-3 text-center text-sm font-semibold transition-all',
                    p.highlight
                      ? 'bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/25'
                      : 'border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white',
                  ].join(' ')}
                >
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ── */}
      <section className="py-24 border-t border-white/5">
        <div className="mx-auto max-w-6xl px-4">
          <div className="relative overflow-hidden rounded-3xl bg-primary/10 border border-primary/20 p-12 text-center">
            <div aria-hidden className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
            <h2 className="relative text-4xl font-black tracking-tight">
              Готовы автоматизировать доставку?
            </h2>
            <p className="relative mt-4 text-white/50 max-w-md mx-auto">
              Подключитесь за 5 минут. Первые 50 заказов — бесплатно.
            </p>
            <div className="relative mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/register"
                className="rounded-xl bg-primary px-8 py-4 font-bold text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 active:scale-95"
              >
                Зарегистрироваться
              </Link>
              <Link
                href="/contacts"
                className="rounded-xl border border-white/15 px-8 py-4 font-medium text-white/70 transition-all hover:text-white hover:border-white/30"
              >
                Задать вопрос
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
