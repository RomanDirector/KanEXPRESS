import type { Metadata } from 'next'
import Link from 'next/link'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'

export const metadata: Metadata = {
  title: 'О нас — KanExpress',
  description: 'Команда KanExpress — логистический сервис для продавцов Kaspi.kz.',
}

const STATS = [
  { n: '2023',   label: 'Год основания' },
  { n: '500+',   label: 'Продавцов' },
  { n: '12 000', label: 'Заказов в день' },
  { n: '98%',    label: 'Доставлено вовремя' },
]

const VALUES = [
  { title: 'Надёжность', desc: 'Каждый заказ на счету. Берём обязательства и выполняем их точно в срок.' },
  { title: 'Скорость',   desc: 'Автоматизация на каждом этапе — от приёма заказа до подписи получателя.' },
  { title: 'Честность',  desc: 'Оплата только за выполненные доставки. Никаких скрытых комиссий.' },
  { title: 'Партнёрство',desc: 'Строим долгосрочные отношения с продавцами. Ваш рост — наш приоритет.' },
]

const TEAM = [
  { name: 'Алибек М.',  role: 'Основатель & CEO',   initials: 'АМ' },
  { name: 'Дамир С.',   role: 'CTO',                 initials: 'ДС' },
  { name: 'Жанна К.',   role: 'Head of Operations',  initials: 'ЖК' },
  { name: 'Нурлан Т.',  role: 'Head of Sales',       initials: 'НТ' },
  { name: 'Айгерим Б.', role: 'Product Manager',     initials: 'АБ' },
  { name: 'Ерлан О.',   role: 'Lead Developer',      initials: 'ЕО' },
]

const TIMELINE = [
  { year: '2023 Q1', title: 'Идея и прототип',  desc: 'Первый прототип системы. Ручное тестирование с тремя продавцами Kaspi в Алматы.' },
  { year: '2023 Q3', title: 'Запуск MVP',       desc: 'Публичный запуск. 50 первых продавцов, интеграция Kaspi Merchant API.' },
  { year: '2024 Q1', title: '500 продавцов',    desc: 'Достигли отметки 500 активных продавцов. Запустили 2GIS-карту для курьеров.' },
  { year: '2024 Q3', title: 'AI-распределение', desc: 'Внедрили алгоритм автоматического распределения заказов по зонам и курьерам.' },
  { year: '2025',    title: 'Сегодня',           desc: '12 000 заказов в день, 98% вовремя. Расширение в новые города Казахстана.' },
]

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#f8f8f8]">
      <Navbar />

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pt-36 pb-16 text-center">
        <p className="text-xs uppercase tracking-widest text-gray-400 mb-3">О нас</p>
        <h1 className="text-4xl font-light tracking-tight text-gray-900 sm:text-5xl">
          Мы делаем доставку<br />
          <span className="text-primary">проще и выгоднее</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-gray-400 leading-relaxed">
          KanExpress — логистический сервис для продавцов Kaspi.kz. Автоматизируем всё: от приёма заказа до подписи получателя.
        </p>
        <p className="mt-1 text-xs text-gray-300">Алматы, Казахстан · с 2023 года</p>
      </section>

      {/* Stats */}
      <section className="bg-white py-14">
        <div className="mx-auto max-w-4xl px-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-gray-100 rounded-2xl border border-gray-100 overflow-hidden">
            {STATS.map((s) => (
              <div key={s.label} className="px-6 py-8 text-center">
                <div className="text-3xl font-light text-primary">{s.n}</div>
                <div className="mt-1 text-sm text-gray-400">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="bg-[#f8f8f8] py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-xs uppercase tracking-widest text-primary">Миссия</p>
              <h2 className="mb-5 text-3xl font-light tracking-tight text-gray-900">Зачем мы существуем</h2>
              <p className="mb-4 leading-relaxed text-gray-400">
                В Казахстане тысячи продавцов на Kaspi.kz тратят часы на ручную обработку заказов, звонки курьерам и переносы данных в таблицы. Всё это — потерянное время и деньги.
              </p>
              <p className="leading-relaxed text-gray-400">
                Мы создали KanExpress, чтобы дать каждому продавцу инструменты крупного логистического бизнеса по доступной цене.
              </p>
            </div>
            <div className="rounded-2xl bg-white p-8 shadow-sm">
              <blockquote className="text-xl font-light leading-snug text-gray-900">
                "Мы хотим, чтобы каждый продавец Kaspi мог доставлять как крупный маркетплейс — быстро, дёшево и без головной боли."
              </blockquote>
              <p className="mt-4 text-sm text-gray-400">— Алибек М., основатель KanExpress</p>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mb-12 text-center">
            <p className="mb-2 text-xs uppercase tracking-widest text-primary">Ценности</p>
            <h2 className="text-3xl font-light tracking-tight text-gray-900">На чём мы строим работу</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {VALUES.map((v, i) => (
              <div key={v.title} className="rounded-2xl bg-[#f8f8f8] p-7">
                <span className="text-xs font-bold text-primary">0{i + 1}</span>
                <h3 className="mt-3 mb-2 text-lg font-light text-gray-900">{v.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="bg-[#f8f8f8] py-20">
        <div className="mx-auto max-w-3xl px-6">
          <div className="mb-12 text-center">
            <p className="mb-2 text-xs uppercase tracking-widest text-primary">История</p>
            <h2 className="text-3xl font-light tracking-tight text-gray-900">Как мы росли</h2>
          </div>
          <div className="space-y-0">
            {TIMELINE.map((t, i) => (
              <div key={t.year} className="relative flex gap-6 pb-10 last:pb-0">
                {i < TIMELINE.length - 1 && (
                  <div className="absolute left-[19px] top-10 bottom-0 w-px bg-gray-200" />
                )}
                <div className="relative flex-shrink-0">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${i === TIMELINE.length - 1 ? 'border-primary bg-primary' : 'border-gray-200 bg-white'}`}>
                    <span className={`h-2.5 w-2.5 rounded-full ${i === TIMELINE.length - 1 ? 'bg-white' : 'bg-gray-300'}`} />
                  </div>
                </div>
                <div className="pt-1.5">
                  <span className="text-xs font-bold text-primary uppercase tracking-wider">{t.year}</span>
                  <h3 className="mt-0.5 font-light text-gray-900">{t.title}</h3>
                  <p className="mt-1 text-sm text-gray-400 leading-relaxed">{t.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mb-12 text-center">
            <p className="mb-2 text-xs uppercase tracking-widest text-primary">Команда</p>
            <h2 className="text-3xl font-light tracking-tight text-gray-900">Люди за KanExpress</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TEAM.map((t) => (
              <div key={t.name} className="flex items-center gap-4 rounded-2xl bg-[#f8f8f8] p-5">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {t.initials}
                </div>
                <div>
                  <p className="font-light text-gray-900">{t.name}</p>
                  <p className="text-sm text-gray-400">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#0a0a0a] py-20">
        <div className="mx-auto max-w-xl px-6 text-center">
          <p className="text-xs uppercase tracking-widest text-primary mb-3">Начать</p>
          <h2 className="mb-4 text-3xl font-light text-white">Присоединяйтесь к нам</h2>
          <p className="mb-8 text-white/40">Начните автоматизировать доставку прямо сейчас.</p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/register/seller" className="rounded-full bg-primary px-8 py-3.5 text-sm font-semibold text-white transition-all hover:bg-primary/90 active:scale-95">
              Подключить магазин
            </Link>
            <Link href="/contacts" className="rounded-full border border-white/20 px-8 py-3.5 text-sm font-medium text-white/60 transition-all hover:border-white/40 hover:text-white">
              Связаться с нами
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
