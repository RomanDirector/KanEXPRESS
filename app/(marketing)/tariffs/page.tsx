import type { Metadata } from 'next'
import Link from 'next/link'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { Reveal } from '@/components/Reveal'

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

export default function TariffsPage() {
  return (
    <div className="min-h-screen bg-[#f8f8f8]">
      <Navbar />

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pt-36 pb-16 text-center">
        <p className="text-xs uppercase tracking-widest text-primary mb-3">Тарифы</p>
        <h1 className="text-4xl font-light tracking-tight text-gray-900 sm:text-5xl">
          У нас всегда дешевле.<br />И всегда быстрее.
        </h1>
        <p className="mx-auto mt-5 max-w-md text-gray-400 text-sm leading-relaxed">
          Сравните сами — наши тарифы значительно выгоднее стандартной доставки Kaspi.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link href="/register/seller" className="rounded-full bg-primary px-8 py-3.5 text-sm font-semibold text-white transition-all hover:bg-primary/90 active:scale-95">
            Подключить магазин
          </Link>
          <Link href="/contacts" className="rounded-full border-2 border-gray-200 px-8 py-3.5 text-sm font-medium text-gray-500 transition-all hover:border-gray-400 hover:text-gray-900">
            Связаться с нами
          </Link>
        </div>
      </section>

      {/* Comparison table */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-4xl px-6">
          <div className="mb-10">
            <span className="inline-flex items-center gap-2 rounded-full bg-orange-50 border border-orange-100 px-4 py-1.5 text-sm font-medium text-orange-600 mb-4">
              🔥 Доставка дешевле
            </span>
            <h2 className="text-3xl font-light tracking-tight text-gray-900">Сравнение цен на доставку</h2>
            <p className="mt-3 max-w-lg text-gray-400 text-sm leading-relaxed">
              Вы продаёте через Kaspi и хотите снизить затраты? Мы предлагаем выгодную альтернативу.
            </p>
            <ul className="mt-4 space-y-1.5">
              <li className="flex items-center gap-2 text-sm text-gray-400">
                <span className="h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                Если заказ до 5 000 ₸ — Kaspi компенсирует доставку покупателю
              </li>
              <li className="flex items-center gap-2 text-sm text-gray-400">
                <span className="h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                Если выше 15 000 ₸ — действует стандартный тариф Kaspi
              </li>
            </ul>
          </div>

          <div className="overflow-x-auto rounded-2xl shadow-sm border border-gray-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#f8f8f8]">
                  <th className="w-1/4 px-6 pt-5 pb-3 text-left" />
                  <th className="px-6 pt-5 pb-3 text-center">
                    <span className="text-xs font-bold text-primary uppercase tracking-wide">KanEXPRESS</span>
                  </th>
                  <th className="px-6 pt-5 pb-3 text-center" colSpan={2}>
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Kaspi Delivery</span>
                  </th>
                </tr>
                <tr className="bg-[#0a0a0a] text-white">
                  <th className="px-6 py-4 text-left text-xs font-semibold text-white/50 rounded-tl-xl">Вес</th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-white">KanEXPRESS</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-white/50">Kaspi город</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-white/50 rounded-tr-xl">Kaspi Казахстан</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row, i) => (
                  <tr key={row.weight} className={`border-b border-gray-50 last:border-0 ${i % 2 === 0 ? 'bg-white' : 'bg-[#f8f8f8]/50'}`}>
                    <td className="px-6 py-4 font-light text-gray-700">{row.weight}</td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center gap-1 font-semibold text-primary">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5 text-green-500">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3" />
                        </svg>
                        {row.kanexp}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="line-through text-gray-300 text-sm">{row.kaspiCity}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="line-through text-gray-300 text-sm">{row.kaspiKaz}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="bg-[#f8f8f8] py-20">
        <div className="mx-auto max-w-4xl px-6">
          <div className="mb-12 text-center">
            <p className="mb-2 text-xs uppercase tracking-widest text-primary">Почему мы</p>
            <h2 className="text-3xl font-light tracking-tight text-gray-900">Преимущества KanEXPRESS</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {BENEFITS.map((b, i) => (
              <Reveal key={b.title}>
                <div className="rounded-2xl bg-white p-6">
                  <span className="text-xs font-bold text-primary">0{i + 1}</span>
                  <h3 className="mt-3 mb-2 font-light text-gray-900">{b.title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{b.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#0a0a0a] py-20">
        <div className="mx-auto max-w-xl px-6 text-center">
          <p className="text-xs uppercase tracking-widest text-primary mb-3">Начать</p>
          <h2 className="mb-4 text-3xl font-light text-white">Подключитесь прямо сейчас</h2>
          <p className="mb-8 text-white/40 text-sm">Первые 50 заказов — бесплатно.</p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <a
              href="https://wa.me/77767286272"
              className="inline-flex items-center justify-center gap-2.5 rounded-full bg-[#25D366] px-7 py-3.5 text-sm font-semibold text-white transition-all hover:bg-[#22c55e] active:scale-95 wa-pulse"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
              </svg>
              Написать в WhatsApp
            </a>
            <Link href="/register/seller" className="inline-flex items-center justify-center rounded-full border border-white/20 px-7 py-3.5 text-sm font-semibold text-white/70 transition-all hover:border-white/40 hover:text-white">
              Зарегистрироваться
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
