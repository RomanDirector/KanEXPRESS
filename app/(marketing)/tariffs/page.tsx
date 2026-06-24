import type { Metadata } from 'next'
import Link from 'next/link'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'

export const metadata: Metadata = {
  title: 'Тарифы — KanEXPRESS',
  description: 'У нас всегда дешевле. И всегда быстрее. Сравните тарифы KanEXPRESS и Kaspi Delivery.',
}

const ROWS = [
  { weight: 'до 5 кг',  kanexp: '1 000 ₸', kaspiCity: '1 679 ₸', kaspiKaz: '1 455 ₸' },
  { weight: '5–10 кг',  kanexp: '1 000 ₸', kaspiCity: '1 679 ₸', kaspiKaz: '1 903 ₸' },
  { weight: '10–15 кг', kanexp: '2 000 ₸', kaspiCity: '1 679 ₸', kaspiKaz: '1 903 ₸' },
  { weight: '15–20 кг', kanexp: '2 000 ₸', kaspiCity: '3 359 ₸', kaspiKaz: '4 031 ₸' },
  { weight: '20–50 кг', kanexp: '3 000 ₸', kaspiCity: '3 359 ₸', kaspiKaz: '4 031 ₸' },
]

const BENEFITS = [
  { title: 'Дешевле чем Kaspi',  desc: 'Фиксированные тарифы от 1 000 ₸' },
  { title: 'Оплата по факту',    desc: 'Платишь только за доставленные заказы' },
  { title: 'Гибкие условия',     desc: 'Работаем с любыми категориями товаров' },
  { title: 'Поддержка 24/7',     desc: 'Всегда на связи' },
]

const WA_ICON = (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 flex-shrink-0">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
  </svg>
)

export default function TariffsPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <Navbar />

      {/* ── СЕКЦИЯ 1: HERO ── */}
      <section className="relative overflow-hidden bg-[#2D2D2D] pt-16">
        <div aria-hidden className="pointer-events-none absolute -top-40 left-1/4 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />

        <div className="mx-auto max-w-6xl px-4 py-16 lg:py-24">
          <div className="grid items-center gap-10 lg:grid-cols-2">

            {/* Левая часть — текст */}
            <div className="animate-fadein">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                Тарифы KanEXPRESS
              </div>

              <h1 className="text-4xl font-black leading-tight text-white sm:text-5xl lg:text-6xl">
                Тарифы{' '}
                <span className="text-primary">KanEXPRESS</span>
              </h1>

              <p className="mt-4 text-xl font-semibold text-white/80">
                У нас всегда дешевле. И всегда быстрее.
              </p>

              <p className="mt-3 max-w-sm text-base text-white/40 leading-relaxed">
                Сравните сами — наши тарифы значительно выгоднее стандартной доставки Kaspi.
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
            </div>

            {/* Правая часть — 3D иллюстрация */}
            <div className="relative flex items-center justify-center">
              <img
                src="https://lovidostavka.kz/media/heromini8.webp"
                alt="KanEXPRESS доставка"
                className="relative z-10 w-full max-w-sm animate-float drop-shadow-2xl"
              />
            </div>
          </div>
        </div>

        {/* Волна снизу */}
        <div className="relative h-20 overflow-hidden">
          <svg viewBox="0 0 1440 80" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"
            className="absolute bottom-0 left-0 w-full h-full fill-white">
            <path d="M0,80 C240,20 480,60 720,30 C960,0 1200,50 1440,20 L1440,80 Z" />
          </svg>
        </div>
      </section>

      {/* ── СЕКЦИЯ 2: СРАВНЕНИЕ ЦЕН ── */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-5xl px-4">

          {/* Шапка */}
          <div className="mb-10">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-orange-50 border border-orange-200 px-4 py-1.5 text-sm font-bold text-orange-600">
              🔥 Доставка дешевле
            </div>
            <h2 className="text-3xl font-black tracking-tight">Сравнение цен на доставку</h2>
            <p className="mt-3 max-w-lg text-gray-400 leading-relaxed">
              Вы продаёте через Kaspi и хотите снизить затраты? Мы предлагаем выгодную альтернативу.
            </p>
            <ul className="mt-4 space-y-1.5">
              <li className="flex items-start gap-2 text-sm text-gray-500">
                <span className="mt-0.5 h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
                Если заказ до 5 000 ₸ — Kaspi компенсирует доставку покупателю
              </li>
              <li className="flex items-start gap-2 text-sm text-gray-500">
                <span className="mt-0.5 h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
                Если выше 15 000 ₸ — действует стандартный тариф Kaspi
              </li>
            </ul>
          </div>

          {/* Таблица */}
          <div className="overflow-x-auto rounded-2xl shadow-sm">
            <table className="w-full text-sm">

              {/* Логотипы над колонками */}
              <thead>
                <tr className="bg-white">
                  <th className="w-1/4 px-6 pt-5 pb-3 text-left" />
                  <th className="px-6 pt-5 pb-3 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <img src="/assets/2066733.png" alt="KanEXPRESS" className="h-10 w-auto object-contain" />
                      <span className="text-xs font-bold text-primary">KanEXPRESS</span>
                    </div>
                  </th>
                  <th className="px-6 pt-5 pb-3 text-center" colSpan={2}>
                    <div className="flex flex-col items-center gap-2">
                      <img src="/assets/logok.webp" alt="Kaspi Delivery" className="h-10 w-auto object-contain" />
                      <span className="text-xs font-bold text-gray-400">Kaspi Delivery</span>
                    </div>
                  </th>
                </tr>

                {/* Заголовки столбцов */}
                <tr className="bg-[#2D2D2D] text-white">
                  <th className="px-6 py-4 text-left font-semibold text-white/60 rounded-tl-xl">Вес</th>
                  <th className="px-6 py-4 text-center font-bold text-white">KanEXPRESS</th>
                  <th className="px-6 py-4 text-center font-semibold text-white/60">Kaspi город</th>
                  <th className="px-6 py-4 text-center font-semibold text-white/60 rounded-tr-xl">Kaspi Казахстан</th>
                </tr>
              </thead>

              <tbody>
                {ROWS.map((row, i) => (
                  <tr
                    key={row.weight}
                    className={`group border-b border-gray-100 transition-colors hover:bg-primary/5 last:border-0 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                  >
                    <td className="px-6 py-4 font-semibold text-gray-700">{row.weight}</td>

                    {/* KanEXPRESS цена — жирная красная + стрелка вниз */}
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center justify-center gap-1 font-black text-primary text-base">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4 text-green-500">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3" />
                        </svg>
                        {row.kanexp}
                      </span>
                    </td>

                    {/* Kaspi город — зачёркнутый + стрелка вверх */}
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center justify-center gap-1 text-gray-300">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4 text-red-400">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
                        </svg>
                        <span className="line-through text-sm">{row.kaspiCity}</span>
                      </span>
                    </td>

                    {/* Kaspi Казахстан — зачёркнутый + стрелка вверх */}
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center justify-center gap-1 text-gray-300">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4 text-red-400">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
                        </svg>
                        <span className="line-through text-sm">{row.kaspiKaz}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── СЕКЦИЯ 3: ПРЕИМУЩЕСТВА ── */}
      <section className="border-t border-gray-100 bg-gray-50 py-20">
        <div className="mx-auto max-w-5xl px-4">
          <div className="mb-12 text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">Почему мы</p>
            <h2 className="text-3xl font-black tracking-tight">Преимущества KanEXPRESS</h2>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {BENEFITS.map((b) => (
              <div
                key={b.title}
                className="overflow-hidden rounded-2xl bg-white transition-all hover:-translate-y-1 hover:shadow-md"
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
      </section>

      {/* ── СЕКЦИЯ 4: CTA ── */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-6xl px-4">
          <div className="overflow-hidden rounded-3xl flex flex-col md:flex-row">

            {/* Фото курьера с красным overlay */}
            <div className="relative h-48 flex-shrink-0 md:h-auto md:w-[40%]">
              <img
                src="https://lovidostavka.kz/media/hero/hero.webp"
                alt="Курьер KanEXPRESS"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-primary/60" />
            </div>

            {/* Правая часть — тёмный фон */}
            <div className="flex flex-col justify-center bg-[#1A1A1A] px-8 py-10 md:px-12 md:py-14 md:w-[60%]">
              <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-white">
                🔴 Подключение за 5 минут
              </div>

              <h2 className="mb-4 text-3xl font-black leading-tight text-white lg:text-4xl">
                Подключитесь к KanEXPRESS<br />прямо сейчас!
              </h2>

              <p className="mb-8 text-white/50 leading-relaxed">
                Начните экономить на доставке уже сегодня.<br />
                Первые 50 заказов — бесплатно.
              </p>

              <div className="flex flex-col gap-3 sm:flex-row">
                <a
                  href="https://wa.me/77471220267"
                  className="wa-pulse inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-[#25D366] px-6 py-3.5 text-sm font-bold text-white transition-transform hover:scale-105 active:scale-95 sm:w-auto"
                >
                  {WA_ICON}
                  Написать в WhatsApp
                </a>
                <Link
                  href="/register"
                  className="inline-flex w-full items-center justify-center rounded-xl border border-white/20 px-6 py-3.5 text-sm font-semibold text-white transition-all hover:scale-105 hover:border-white/40 sm:w-auto"
                >
                  Зарегистрироваться
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
