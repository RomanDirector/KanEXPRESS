'use client'

import { useEffect, useRef } from 'react'
import { UserPlus, RefreshCw, Truck, CreditCard } from 'lucide-react'

const STEPS = [
  {
    Icon: UserPlus,
    title: 'Зарегистрируйтесь',
    desc: 'Создайте аккаунт и подключите Kaspi-магазин за 5 минут. Вводите Kaspi Token и Shop ID — система сама всё настроит.',
  },
  {
    Icon: RefreshCw,
    title: 'Заказы приходят автоматически',
    desc: 'Система каждые 10 минут забирает новые заказы из Kaspi. Никакого ручного труда — всё происходит само.',
  },
  {
    Icon: Truck,
    title: 'Курьеры доставляют по умным маршрутам',
    desc: 'AI распределяет заказы по районам. Курьер видит маршрут на карте и едет по оптимальному пути.',
  },
  {
    Icon: CreditCard,
    title: 'Платите только за доставленные заказы',
    desc: 'Никакой предоплаты. Счёт выставляется автоматически в конце недели только за выполненные доставки.',
  },
]

export function HowItWorks() {
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const cards = wrapperRef.current?.querySelectorAll<HTMLElement>('.card-reveal')
    if (!cards) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('animate-in')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.15 }
    )

    cards.forEach((card) => observer.observe(card))
    return () => observer.disconnect()
  }, [])

  return (
    <section className="py-24 bg-gray-50 border-t border-gray-100">
      <div className="mx-auto max-w-6xl px-4">

        {/* Header */}
        <div className="mb-16 text-center">
          <h2 className="text-4xl font-black tracking-tight">Как это работает</h2>
          <div className="mx-auto mt-3 h-1 w-14 rounded-full bg-primary" />
          <p className="mt-5 text-gray-400 max-w-xs mx-auto">Четыре простых шага до первой доставки</p>
        </div>

        {/* Cards grid */}
        <div ref={wrapperRef} className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => {
            const { Icon } = s
            return (
              <div
                key={s.title}
                className="relative"
              >
                {/* Scroll-reveal wrapper */}
                <div
                  className="card-reveal h-full"
                  style={{ animationDelay: `${i * 0.1}s` }}
                >
                  {/* Card */}
                  <div className="group h-full rounded-2xl bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-xl">
                    {/* Icon circle */}
                    <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary overflow-hidden">
                      <Icon
                        className="h-6 w-6 text-white transition-transform duration-500 group-hover:rotate-[360deg]"
                        strokeWidth={2}
                      />
                    </div>

                    <p className="mb-1.5 text-xs font-bold uppercase tracking-widest text-primary">
                      ШАГ {i + 1}
                    </p>
                    <h3 className="mb-2 font-black text-gray-900 leading-snug">{s.title}</h3>
                    <p className="text-sm text-gray-400 leading-relaxed">{s.desc}</p>
                  </div>
                </div>

                {/* Arrow → between cards (desktop only) */}
                {i < STEPS.length - 1 && (
                  <div className="absolute -right-3.5 top-10 z-10 hidden lg:flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-sm border border-gray-100 text-gray-300">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                    </svg>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
