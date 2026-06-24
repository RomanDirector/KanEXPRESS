import type { Metadata } from 'next'
import Link from 'next/link'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { HowItWorks } from '@/components/sections/how-it-works'
import { CtaSection } from '@/components/sections/cta-section'

export const metadata: Metadata = {
  title: 'KanExpress — Доставка товаров продавцов Kaspi.kz',
  description: 'Быстро, надёжно и дешевле чем Kaspi. Автоматизируйте доставку заказов с Kaspi.kz.',
}

const PRICES = [
  { weight: 'до 5 кг',  intime: '1 000 ₸', kaspiCity: '1 679 ₸', kaspiKaz: '1 455 ₸' },
  { weight: '5–10 кг',  intime: '1 000 ₸', kaspiCity: '1 679 ₸', kaspiKaz: '1 903 ₸' },
  { weight: '10–15 кг', intime: '2 000 ₸', kaspiCity: '1 679 ₸', kaspiKaz: '1 903 ₸' },
  { weight: '15–20 кг', intime: '2 000 ₸', kaspiCity: '3 359 ₸', kaspiKaz: '4 031 ₸' },
  { weight: '20–50 кг', intime: '3 000 ₸', kaspiCity: '3 359 ₸', kaspiKaz: '4 031 ₸' },
]

const BENEFITS = [
  { title: 'Дешевле чем Kaspi',  desc: 'Наши тарифы значительно ниже стандартных тарифов Kaspi на доставку.' },
  { title: 'Оплата по факту',    desc: 'Платите только за выполненные доставки. Никаких абонентских плат.' },
  { title: 'Гибкие условия',     desc: 'Настройте расписание, зоны доставки и условия под ваш бизнес.' },
  { title: 'Поддержка 24/7',     desc: 'Наша команда всегда на связи и готова помочь в любое время суток.' },
]

const REVIEWS = [
  { name: 'Айгерим С.', role: 'Продавец Kaspi, Алматы', text: 'Отличный сервис! Доставка стала намного дешевле, а клиенты довольны быстрой доставкой. Рекомендую всем продавцам.' },
  { name: 'Нурлан К.', role: 'Владелец интернет-магазина', text: 'Подключился за 5 минут, заказы пошли автоматически. Экономия на доставке составила около 40%.' },
  { name: 'Дана М.', role: 'Магазин одежды, Астана', text: 'Сэкономили более 30% на доставке по сравнению с Kaspi. Очень удобная система, всё автоматически.' },
  { name: 'Бауыржан Т.', role: 'Продавец электроники', text: 'Поддержка отвечает моментально. Система удобная, всё видно в реальном времени. Очень доволен!' },
  { name: 'Жанар А.', role: 'Магазин косметики', text: 'Наконец-то нашли сервис с адекватными ценами. Курьеры пунктуальные и вежливые, клиенты довольны.' },
  { name: 'Серик О.', role: 'Продавец бытовой техники', text: 'Работаем уже 3 месяца. Ни одного серьёзного сбоя. Система надёжная, очень рекомендую!' },
]

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <Navbar />

      {/* ── HERO ── */}
      <section className="relative overflow-hidden bg-[#2D2D2D] pt-16">
        <div className="mx-auto max-w-6xl px-4 py-16 lg:py-24">
          <div className="grid items-center gap-10 lg:grid-cols-2">

            {/* Left: text */}
            <div className="animate-fadein">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                Интеграция с Kaspi Merchant API
              </div>
              <h1 className="text-4xl font-black leading-tight tracking-tight text-white sm:text-5xl">
                Доставка товаров<br />
                продавцов{' '}
                <span className="text-primary">Kaspi.kz</span>
              </h1>
              <p className="mt-5 text-xl font-medium text-white/70">
                Быстро, надёжно и дешевле чем Kaspi
              </p>
              <p className="mt-3 text-base text-white/40 leading-relaxed max-w-sm">
                Автоматизируйте доставку заказов — от Kaspi до двери покупателя. Без лишних звонков и таблиц.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link
                  href="/register"
                  className="rounded-xl bg-primary px-8 py-4 text-base font-bold text-white shadow-lg shadow-primary/30 transition-all hover:bg-primary/90 active:scale-95"
                >
                  Регистрация
                </Link>
                <Link
                  href="/login"
                  className="rounded-xl border border-white/20 bg-white/10 px-8 py-4 text-base font-medium text-white transition-all hover:bg-white/20"
                >
                  Вход
                </Link>
              </div>

              {/* Mini stats */}
              <div className="mt-10 flex gap-8">
                {[
                  { n: '500+', label: 'продавцов' },
                  { n: '12 000', label: 'заказов / день' },
                  { n: '98%', label: 'вовремя' },
                ].map((s) => (
                  <div key={s.label}>
                    <div className="text-2xl font-black text-white">{s.n}</div>
                    <div className="text-xs text-white/30 mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: 3D illustration */}
            <div className="relative flex items-center justify-center min-h-[340px]">
              <img
                src="https://lovidostavka.kz/media/hero.webp"
                alt="Доставка"
                className="relative z-10 w-full max-w-md animate-float drop-shadow-2xl"
              />
              <img
                src="https://lovidostavka.kz/media/heromini8.webp"
                alt=""
                className="absolute bottom-4 -left-2 z-20 w-28 sm:w-36 animate-float-delayed drop-shadow-xl"
              />
            </div>
          </div>
        </div>

        {/* Wave transition to white */}
        <div className="relative h-20 overflow-hidden">
          <svg
            viewBox="0 0 1440 80"
            preserveAspectRatio="none"
            xmlns="http://www.w3.org/2000/svg"
            className="absolute bottom-0 left-0 w-full h-full fill-white"
          >
            <path d="M0,80 C240,20 480,60 720,30 C960,0 1200,50 1440,20 L1440,80 Z" />
          </svg>
        </div>
      </section>

      {/* ── PRICE COMPARISON ── */}
      <section className="py-20 bg-white">
        <div className="mx-auto max-w-4xl px-4">
          <div className="mb-12 text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">Тарифы</p>
            <h2 className="text-3xl font-black tracking-tight">Сравнение цен на доставку</h2>
            <p className="mt-3 text-gray-400 max-w-sm mx-auto">Убедитесь сами — наши цены выгоднее.</p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-6 pt-5 pb-3 text-left font-semibold text-gray-600">
                    <img src="/assets/2066733.png" alt="" className="mb-2 h-10 w-auto object-contain" />
                    Вес
                  </th>
                  <th className="px-6 pt-5 pb-3 text-center font-bold text-primary">In Time</th>
                  <th className="px-6 pt-5 pb-3 text-center font-semibold text-gray-500">
                    <img src="/assets/logok.webp" alt="Kaspi" className="mb-2 h-10 w-auto object-contain mx-auto" />
                    Kaspi город
                  </th>
                  <th className="px-6 pt-5 pb-3 text-center font-semibold text-gray-500">Kaspi Казахстан</th>
                </tr>
              </thead>
              <tbody>
                {PRICES.map((row, i) => (
                  <tr
                    key={row.weight}
                    className={`border-b border-gray-100 last:border-0 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                  >
                    <td className="px-6 py-4 font-medium text-gray-700">{row.weight}</td>
                    <td className="px-6 py-4 text-center font-black text-primary text-base">{row.intime}</td>
                    <td className="px-6 py-4 text-center text-gray-400 line-through">{row.kaspiCity}</td>
                    <td className="px-6 py-4 text-center text-gray-400 line-through">{row.kaspiKaz}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <HowItWorks />

      {/* ── BENEFITS ── */}
      <section className="py-20 bg-white border-t border-gray-100">
        <div className="mx-auto max-w-6xl px-4">
          <div className="grid items-center gap-10 lg:grid-cols-2">

            {/* Left: cards */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">Преимущества</p>
              <h2 className="mb-8 text-3xl font-black tracking-tight">Почему выбирают нас</h2>
              <div className="grid grid-cols-2 gap-5">
                {BENEFITS.map((b) => (
                  <div
                    key={b.title}
                    className="rounded-2xl bg-gray-50 overflow-hidden transition-all hover:-translate-y-1 hover:shadow-md"
                  >
                    <div className="h-1.5 w-full bg-primary" />
                    <div className="p-6">
                      <h3 className="mb-2 font-bold text-gray-900">{b.title}</h3>
                      <p className="text-sm text-gray-500 leading-relaxed">{b.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: image */}
            <div className="flex flex-col items-center lg:items-end">
              <p className="mb-4 text-base font-semibold text-gray-400 tracking-wide">Наши преимущества</p>
              <img
                src="/assets/7-scaled-qrmyf8uxufz8w117whhoic926o0qn08hkqnsh0qb8w.jpg"
                alt="Наши преимущества"
                className="w-full max-w-md rounded-2xl object-cover shadow-lg"
              />
            </div>

          </div>
        </div>
      </section>

      {/* ── REVIEWS ── */}
      <section className="py-20 bg-gray-50 border-t border-gray-100">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-12 text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">Отзывы</p>
            <h2 className="text-3xl font-black tracking-tight">Что говорят клиенты</h2>
            <p className="mt-3 text-gray-400 max-w-sm mx-auto">Более 500 продавцов уже работают с нами.</p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {REVIEWS.map((r) => (
              <div
                key={r.name}
                className="rounded-2xl border border-gray-200 bg-white p-6 transition-all hover:shadow-md"
              >
                <div className="mb-3 flex gap-0.5 text-primary text-lg">
                  {'★★★★★'.split('').map((star, i) => <span key={i}>{star}</span>)}
                </div>
                <p className="mb-4 text-sm text-gray-600 leading-relaxed">"{r.text}"</p>
                <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                    {r.name[0]}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{r.name}</p>
                    <p className="text-xs text-gray-400">{r.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CtaSection />

      {/* ── FAQ ── */}
      <section className="py-20 bg-white border-t border-gray-100">
        <div className="mx-auto max-w-3xl px-4">
          <div className="mb-12 text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">FAQ</p>
            <h2 className="text-3xl font-black tracking-tight">Часто задаваемые вопросы</h2>
            <p className="mt-3 text-gray-400 max-w-sm mx-auto">Не нашли ответ? Напишите нам в WhatsApp.</p>
          </div>

          <div className="space-y-3">
            {[
              {
                q: 'Как подключить мой магазин Kaspi.kz?',
                a: 'После регистрации перейдите в настройки и вставьте API-ключ вашего магазина из личного кабинета Kaspi Merchant. Заказы начнут поступать автоматически в течение 10 минут.',
              },
              {
                q: 'Сколько стоит доставка?',
                a: 'Тарифы начинаются от 1 000 ₸ за посылку до 5 кг. Это значительно дешевле стандартных тарифов Kaspi (от 1 455 ₸). Точные цены — в разделе "Сравнение цен" выше.',
              },
              {
                q: 'Как быстро доставляются заказы?',
                a: 'По городу — в день заказа или на следующий день. Курьер видит оптимальный маршрут на карте 2GIS и приезжает к клиенту в удобное время.',
              },
              {
                q: 'Что делать, если клиент отказался от товара?',
                a: 'Курьер оформляет возврат прямо в приложении. Посылка возвращается на склад, статус автоматически обновляется в вашем дашборде. Оплата за возврат не взимается.',
              },
              {
                q: 'Как отслеживать статус доставки?',
                a: 'Все статусы обновляются в режиме реального времени в вашем личном кабинете. Покупатель получает WhatsApp-уведомление на каждом этапе — без вашего участия.',
              },
              {
                q: 'Есть ли минимальное количество заказов?',
                a: 'Нет. На тарифе "Старт" — бесплатно до 50 заказов в месяц. Платите только когда вырастете и перейдёте на тариф "Бизнес".',
              },
              {
                q: 'Работает ли сервис в других городах Казахстана?',
                a: 'Сейчас работаем в Алматы. Астана и другие крупные города — в планах на ближайший квартал. Оставьте заявку, и мы сообщим о запуске в вашем городе.',
              },
              {
                q: 'Как происходит оплата за услуги?',
                a: 'Оплата только за фактически выполненные доставки. Раз в неделю формируется счёт, который можно оплатить картой или через Kaspi Pay. Никаких скрытых комиссий.',
              },
            ].map((item) => (
              <details
                key={item.q}
                className="group rounded-2xl border border-gray-200 bg-gray-50 open:bg-white open:shadow-sm transition-all"
              >
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

          <div className="mt-10 text-center">
            <p className="text-gray-400 text-sm mb-4">Остались вопросы?</p>
            <a
              href="https://wa.me/77000000000"
              className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-[#22c55e] active:scale-95"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
              </svg>
              Написать в WhatsApp
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
