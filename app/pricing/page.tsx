import type { Metadata } from 'next'
import Link from 'next/link'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'

export const metadata: Metadata = {
  title: 'Тарифы — KanExpress',
  description: 'Простые и прозрачные цены на логистику для продавцов Kaspi.kz.',
}

const PLANS = [
  {
    name: 'Старт',
    price: 'Бесплатно',
    sub: 'навсегда',
    cta: 'Начать бесплатно',
    ctaHref: '/register',
    highlight: false,
    desc: 'Для тех, кто только начинает продавать на Kaspi.',
    features: [
      'До 50 заказов в месяц',
      '1 курьер',
      'Накладные PDF',
      'Базовая статистика',
      'Email-поддержка',
    ],
    notIncluded: [
      'WhatsApp-уведомления',
      '2GIS-карта маршрутов',
      'AI-распределение',
      'SLA гарантия',
    ],
  },
  {
    name: 'Бизнес',
    price: '9 900 ₸',
    sub: 'в месяц',
    cta: 'Попробовать 14 дней бесплатно',
    ctaHref: '/register',
    highlight: true,
    desc: 'Для активных продавцов с потоком заказов.',
    features: [
      'Неограниченно заказов',
      'До 10 курьеров',
      'WhatsApp-уведомления',
      '2GIS-карта маршрутов',
      'Полная аналитика',
      'Пакетная печать накладных',
      'Приоритетная поддержка',
    ],
    notIncluded: [
      'AI-распределение курьеров',
      'SLA гарантия 99.9%',
    ],
  },
  {
    name: 'Корпоративный',
    price: 'По запросу',
    sub: 'индивидуально',
    cta: 'Связаться с нами',
    ctaHref: '/contacts',
    highlight: false,
    desc: 'Для крупных продавцов и логистических компаний.',
    features: [
      'Неограниченно всего',
      'Неограниченно курьеров',
      'AI-распределение заказов',
      'SLA гарантия 99.9%',
      'Интеграции под ключ',
      'Выделенный менеджер',
      'Обучение команды',
      'Индивидуальные отчёты',
    ],
    notIncluded: [],
  },
]

const COMPARE = [
  { feature: 'Заказов в месяц',         start: 'До 50',       biz: 'Неограниченно', corp: 'Неограниченно' },
  { feature: 'Курьеров',                 start: '1',           biz: 'До 10',         corp: 'Неограниченно' },
  { feature: 'Накладные PDF',            start: true,          biz: true,            corp: true },
  { feature: 'WhatsApp-уведомления',     start: false,         biz: true,            corp: true },
  { feature: '2GIS-карта маршрутов',     start: false,         biz: true,            corp: true },
  { feature: 'Аналитика',               start: 'Базовая',     biz: 'Полная',        corp: 'Расширенная' },
  { feature: 'AI-распределение',         start: false,         biz: false,           corp: true },
  { feature: 'SLA 99.9%',               start: false,         biz: false,           corp: true },
  { feature: 'Поддержка',               start: 'Email',       biz: 'Приоритетная',  corp: 'Выделенный менеджер' },
  { feature: 'Интеграции под ключ',      start: false,         biz: false,           corp: true },
]

const FAQS = [
  {
    q: 'Есть ли пробный период?',
    a: 'Тариф "Бизнес" включает 14 дней бесплатного пробного периода. Карта не нужна. Тариф "Старт" бесплатен навсегда.',
  },
  {
    q: 'Как считается оплата?',
    a: 'Оплата за подписку списывается раз в месяц. Плюс оплата за каждую выполненную доставку по тарифу. Никаких скрытых комиссий.',
  },
  {
    q: 'Можно ли сменить тариф?',
    a: 'Да, в любой момент через личный кабинет. При повышении тарифа — доступ расширяется сразу. При понижении — изменения вступают в силу с нового периода.',
  },
  {
    q: 'Что будет если я превышу лимит заказов на тарифе Старт?',
    a: 'Мы уведомим вас когда останется 10 заказов. После достижения лимита новые заказы не будут синхронизироваться до следующего месяца или смены тарифа.',
  },
  {
    q: 'Есть ли скидка при оплате за год?',
    a: 'Да! При годовой оплате тарифа "Бизнес" скидка 20% — выходит 7 920 ₸ в месяц вместо 9 900 ₸. Свяжитесь с нами для оформления.',
  },
]

const Check = () => (
  <svg className="w-5 h-5 text-primary flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
  </svg>
)

const Cross = () => (
  <svg className="w-5 h-5 text-gray-200 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
  </svg>
)

const TableCheck = ({ value }: { value: boolean | string }) => {
  if (value === true)  return <span className="inline-flex justify-center"><Check /></span>
  if (value === false) return <span className="inline-flex justify-center"><Cross /></span>
  return <span className="text-sm text-gray-600">{value}</span>
}

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden bg-[#2D2D2D] pt-16">
        <div aria-hidden className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="mx-auto max-w-3xl px-4 py-20 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            Без скрытых комиссий
          </div>
          <h1 className="text-4xl font-black leading-tight text-white sm:text-5xl">
            Простые и прозрачные <span className="text-primary">цены</span>
          </h1>
          <p className="mx-auto mt-5 max-w-lg text-lg text-white/50 leading-relaxed">
            Начните бесплатно. Платите только когда вырастете. Никаких скрытых платежей и обязательных договоров.
          </p>
        </div>
        <div className="relative h-16 overflow-hidden">
          <svg viewBox="0 0 1440 64" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" className="absolute bottom-0 left-0 w-full h-full fill-white">
            <path d="M0,64 C360,0 1080,64 1440,0 L1440,64 Z" />
          </svg>
        </div>
      </section>

      {/* Plans */}
      <section className="py-20 bg-white">
        <div className="mx-auto max-w-6xl px-4">
          <div className="grid gap-6 md:grid-cols-3">
            {PLANS.map((p) => (
              <div
                key={p.name}
                className={[
                  'relative flex flex-col rounded-2xl border p-7 transition-all',
                  p.highlight
                    ? 'border-primary bg-primary/5 shadow-xl shadow-primary/10'
                    : 'border-gray-200 bg-white hover:shadow-md',
                ].join(' ')}
              >
                {p.highlight && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-bold text-white shadow-sm">
                    Популярный выбор
                  </div>
                )}

                <div className="mb-6">
                  <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">{p.name}</p>
                  <div className="mt-2 flex items-end gap-1">
                    <span className="text-4xl font-black text-gray-900">{p.price}</span>
                    {p.sub && <span className="mb-1 text-sm text-gray-400">/ {p.sub}</span>}
                  </div>
                  <p className="mt-3 text-sm text-gray-500 leading-relaxed">{p.desc}</p>
                </div>

                <Link
                  href={p.ctaHref}
                  className={[
                    'mb-6 rounded-xl py-3 text-center text-sm font-semibold transition-all',
                    p.highlight
                      ? 'bg-primary text-white hover:bg-primary/90 shadow-md shadow-primary/20'
                      : 'border border-gray-200 text-gray-700 hover:border-primary hover:text-primary',
                  ].join(' ')}
                >
                  {p.cta}
                </Link>

                <div className="space-y-2.5">
                  {p.features.map((f) => (
                    <div key={f} className="flex items-start gap-2.5 text-sm text-gray-700">
                      <Check />
                      {f}
                    </div>
                  ))}
                  {p.notIncluded.map((f) => (
                    <div key={f} className="flex items-start gap-2.5 text-sm text-gray-300">
                      <Cross />
                      {f}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison table */}
      <section className="py-20 bg-gray-50 border-t border-gray-100">
        <div className="mx-auto max-w-5xl px-4">
          <div className="mb-12 text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">Детали</p>
            <h2 className="text-3xl font-black tracking-tight">Сравнение тарифов</h2>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-6 py-4 text-left font-semibold text-gray-500 w-1/2">Функция</th>
                  <th className="px-6 py-4 text-center font-semibold text-gray-500">Старт</th>
                  <th className="px-6 py-4 text-center font-bold text-primary">Бизнес</th>
                  <th className="px-6 py-4 text-center font-semibold text-gray-500">Корпоративный</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE.map((row, i) => (
                  <tr key={row.feature} className={`border-b border-gray-50 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                    <td className="px-6 py-3.5 font-medium text-gray-700">{row.feature}</td>
                    <td className="px-6 py-3.5 text-center"><TableCheck value={row.start} /></td>
                    <td className="px-6 py-3.5 text-center bg-primary/3"><TableCheck value={row.biz} /></td>
                    <td className="px-6 py-3.5 text-center"><TableCheck value={row.corp} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-white border-t border-gray-100">
        <div className="mx-auto max-w-3xl px-4">
          <div className="mb-12 text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">FAQ</p>
            <h2 className="text-3xl font-black tracking-tight">Вопросы о тарифах</h2>
          </div>
          <div className="space-y-3">
            {FAQS.map((item) => (
              <details key={item.q} className="group rounded-2xl border border-gray-200 bg-gray-50 open:bg-white open:shadow-sm">
                <summary className="flex cursor-pointer items-center justify-between gap-4 px-6 py-5 font-semibold text-gray-900 list-none">
                  {item.q}
                  <span className="flex-shrink-0 rounded-lg bg-gray-100 p-1.5 text-gray-400 transition-transform group-open:rotate-45 group-open:bg-primary/10 group-open:text-primary">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  </span>
                </summary>
                <p className="px-6 pb-5 text-sm text-gray-500 leading-relaxed">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-[#1A1A1A]">
        <div className="mx-auto max-w-2xl px-4 text-center">
          <h2 className="text-3xl font-black text-white mb-4">Не уверены какой тариф выбрать?</h2>
          <p className="text-white/40 mb-8">Напишите нам — подберём оптимальный план под ваш объём заказов.</p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/register" className="rounded-xl bg-primary px-8 py-4 font-bold text-white hover:bg-primary/90 transition-all active:scale-95">
              Начать бесплатно
            </Link>
            <Link href="/contacts" className="rounded-xl border border-white/20 px-8 py-4 font-medium text-white/70 hover:text-white hover:border-white/40 transition-all">
              Задать вопрос
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
