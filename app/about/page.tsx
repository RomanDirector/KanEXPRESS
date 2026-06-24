import type { Metadata } from 'next'
import Link from 'next/link'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'

export const metadata: Metadata = {
  title: 'О нас — KanExpress',
  description: 'Команда KanExpress — логистический сервис для продавцов Kaspi.kz. Наша история, миссия и ценности.',
}

const STATS = [
  { n: '2023',   label: 'Год основания' },
  { n: '500+',   label: 'Продавцов' },
  { n: '12 000', label: 'Заказов в день' },
  { n: '98%',    label: 'Доставлено вовремя' },
]

const VALUES = [
  {
    title: 'Надёжность',
    desc: 'Каждый заказ на счету. Мы берём обязательства и выполняем их точно в срок — без оговорок.',
  },
  {
    title: 'Скорость',
    desc: 'Автоматизация на каждом этапе — от приёма заказа до подписи получателя. Никакого ручного труда.',
  },
  {
    title: 'Честность',
    desc: 'Оплата только за выполненные доставки. Никаких скрытых комиссий, абонентских плат и сюрпризов в счёте.',
  },
  {
    title: 'Партнёрство',
    desc: 'Мы строим долгосрочные отношения с продавцами. Ваш рост — наш приоритет.',
  },
]

const TEAM = [
  { name: 'Алибек М.',  role: 'Основатель & CEO',      initials: 'АМ', color: 'bg-primary/10 text-primary' },
  { name: 'Дамир С.',   role: 'CTO',                    initials: 'ДС', color: 'bg-blue-50 text-blue-600' },
  { name: 'Жанна К.',   role: 'Head of Operations',     initials: 'ЖК', color: 'bg-green-50 text-green-600' },
  { name: 'Нурлан Т.',  role: 'Head of Sales',          initials: 'НТ', color: 'bg-purple-50 text-purple-600' },
  { name: 'Айгерим Б.', role: 'Product Manager',        initials: 'АБ', color: 'bg-yellow-50 text-yellow-600' },
  { name: 'Ерлан О.',   role: 'Lead Developer',         initials: 'ЕО', color: 'bg-primary/10 text-primary' },
]

const TIMELINE = [
  { year: '2023 Q1', title: 'Идея и прототип', desc: 'Первый прототип системы. Ручное тестирование с тремя продавцами Kaspi в Алматы.' },
  { year: '2023 Q3', title: 'Запуск MVP',      desc: 'Публичный запуск. 50 первых продавцов, интеграция Kaspi Merchant API.' },
  { year: '2024 Q1', title: '500 продавцов',   desc: 'Достигли отметки 500 активных продавцов. Запустили 2GIS-карту для курьеров.' },
  { year: '2024 Q3', title: 'AI-распределение',desc: 'Внедрили алгоритм автоматического распределения заказов по зонам и курьерам.' },
  { year: '2025',    title: 'Сегодня',          desc: '12 000 заказов в день, 98% вовремя. Расширение в новые города Казахстана.' },
]

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden bg-[#2D2D2D] pt-16">
        <div aria-hidden className="pointer-events-none absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="mx-auto max-w-4xl px-4 py-20 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            Алматы, Казахстан · с 2023 года
          </div>
          <h1 className="text-4xl font-black leading-tight text-white sm:text-5xl">
            Мы делаем доставку<br />
            <span className="text-primary">проще и выгоднее</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-white/50 leading-relaxed">
            KanExpress — логистический сервис для продавцов Kaspi.kz. Автоматизируем всё: от приёма заказа до подписи получателя.
          </p>
        </div>
        <div className="relative h-16 overflow-hidden">
          <svg viewBox="0 0 1440 64" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" className="absolute bottom-0 left-0 w-full h-full fill-white">
            <path d="M0,64 C360,0 1080,64 1440,0 L1440,64 Z" />
          </svg>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-4xl px-4">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-gray-200 bg-gray-200 sm:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="bg-white px-6 py-8 text-center">
                <div className="text-3xl font-black text-primary">{s.n}</div>
                <div className="mt-1 text-sm text-gray-400">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="border-t border-gray-100 bg-gray-50 py-20">
        <div className="mx-auto max-w-5xl px-4">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">Миссия</p>
              <h2 className="mb-5 text-3xl font-black tracking-tight">Зачем мы существуем</h2>
              <p className="mb-4 leading-relaxed text-gray-500">
                В Казахстане тысячи продавцов на Kaspi.kz тратят часы на ручную обработку заказов, звонки курьерам и переносы данных в таблицы. Всё это — потерянное время и деньги.
              </p>
              <p className="leading-relaxed text-gray-500">
                Мы создали KanExpress, чтобы дать каждому продавцу инструменты крупного логистического бизнеса по доступной цене. Автоматизация, прозрачность, надёжность — не для корпораций, а для обычных предпринимателей.
              </p>
            </div>
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-8">
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                </svg>
              </div>
              <blockquote className="text-xl font-bold leading-snug text-gray-900">
                "Мы хотим, чтобы каждый продавец Kaspi мог доставлять как крупный маркетплейс — быстро, дёшево и без головной боли."
              </blockquote>
              <p className="mt-4 text-sm text-gray-400">— Алибек М., основатель KanExpress</p>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="border-t border-gray-100 bg-white py-20">
        <div className="mx-auto max-w-5xl px-4">
          <div className="mb-12 text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">Ценности</p>
            <h2 className="text-3xl font-black tracking-tight">На чём мы строим работу</h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            {VALUES.map((v) => (
              <div key={v.title} className="overflow-hidden rounded-2xl bg-gray-50 transition-all hover:-translate-y-1 hover:shadow-md">
                <div className="h-1.5 w-full bg-primary" />
                <div className="p-6">
                  <h3 className="mb-2 font-bold text-gray-900">{v.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{v.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="border-t border-gray-100 bg-gray-50 py-20">
        <div className="mx-auto max-w-3xl px-4">
          <div className="mb-12 text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">История</p>
            <h2 className="text-3xl font-black tracking-tight">Как мы росли</h2>
          </div>
          <div className="relative space-y-0">
            {TIMELINE.map((t, i) => (
              <div key={t.year} className="relative flex gap-6 pb-10 last:pb-0">
                {/* Line */}
                {i < TIMELINE.length - 1 && (
                  <div className="absolute left-[19px] top-10 bottom-0 w-px bg-gray-200" />
                )}
                {/* Dot */}
                <div className="relative flex-shrink-0">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${i === TIMELINE.length - 1 ? 'border-primary bg-primary' : 'border-gray-200 bg-white'}`}>
                    {i === TIMELINE.length - 1 ? (
                      <span className="h-2.5 w-2.5 rounded-full bg-white" />
                    ) : (
                      <span className="h-2.5 w-2.5 rounded-full bg-gray-300" />
                    )}
                  </div>
                </div>
                {/* Content */}
                <div className="pt-1.5">
                  <span className="text-xs font-bold text-primary uppercase tracking-wider">{t.year}</span>
                  <h3 className="mt-0.5 font-bold text-gray-900">{t.title}</h3>
                  <p className="mt-1 text-sm text-gray-500 leading-relaxed">{t.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="border-t border-gray-100 bg-white py-20">
        <div className="mx-auto max-w-5xl px-4">
          <div className="mb-12 text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">Команда</p>
            <h2 className="text-3xl font-black tracking-tight">Люди за KanExpress</h2>
            <p className="mt-3 text-gray-400 max-w-sm mx-auto">Небольшая команда с большими целями.</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {TEAM.map((t) => (
              <div key={t.name} className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-gray-50 p-5">
                <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-base font-black ${t.color}`}>
                  {t.initials}
                </div>
                <div>
                  <p className="font-bold text-gray-900">{t.name}</p>
                  <p className="text-sm text-gray-400">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#1A1A1A] py-20">
        <div className="mx-auto max-w-xl px-4 text-center">
          <h2 className="mb-4 text-3xl font-black text-white">Присоединяйтесь к нам</h2>
          <p className="mb-8 text-white/40">Начните автоматизировать доставку прямо сейчас.</p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/register" className="rounded-xl bg-primary px-8 py-4 font-bold text-white transition-all hover:bg-primary/90 active:scale-95">
              Зарегистрироваться
            </Link>
            <Link href="/contacts" className="rounded-xl border border-white/20 px-8 py-4 font-medium text-white/70 transition-all hover:text-white hover:border-white/40">
              Связаться с нами
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
