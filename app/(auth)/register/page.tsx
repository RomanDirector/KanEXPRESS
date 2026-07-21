'use client'

import Link from 'next/link'
import { Navbar } from '@/components/layout/navbar'

const ROLES = [
  {
    num: '01',
    title: 'Магазин',
    desc: 'Подключите Kaspi-магазин, синхронизируйте заказы и управляйте доставкой из единой панели.',
    cta: 'Подключить магазин',
    href: '/register/seller',
    dark: true,
  },
  {
    num: '02',
    title: 'Курьер',
    desc: 'Принимайте заказы, стройте маршруты и отслеживайте выплаты прямо в приложении.',
    cta: 'Стать курьером',
    href: '/register-courier',
    dark: false,
  },
  {
    num: '03',
    title: 'Партнёр',
    desc: 'Привлекайте магазины по промокоду и получайте выплату за каждого активного продавца.',
    cta: 'Стать партнёром',
    href: '/register-partner',
    dark: false,
  },
]

export default function RegisterRolePage() {
  return (
    <div className="min-h-screen bg-[#f8f8f8]">
      <Navbar />

      <main className="mx-auto max-w-5xl px-6 pt-36 pb-24">
        <div className="text-center mb-14">
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-3">Регистрация</p>
          <h1 className="text-4xl font-light tracking-tight text-gray-900">Выберите вашу роль</h1>
          <p className="mt-3 text-sm text-gray-400">
            Уже есть аккаунт?{' '}
            <Link href="/login" className="text-primary font-medium hover:underline">Войти</Link>
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {ROLES.map((role) => (
            <div
              key={role.num}
              className={`group flex flex-col rounded-2xl p-8 transition-all hover:shadow-lg ${
                role.dark ? 'bg-[#0a0a0a]' : 'bg-white'
              }`}
            >
              <span className="text-xs font-bold text-primary mb-6">{role.num}</span>

              <h2 className={`text-2xl font-light tracking-tight mb-3 ${role.dark ? 'text-white' : 'text-gray-900'}`}>
                {role.title}
              </h2>

              <p className={`text-sm leading-relaxed flex-1 mb-8 ${role.dark ? 'text-white/50' : 'text-gray-400'}`}>
                {role.desc}
              </p>

              <Link
                href={role.href}
                className="inline-flex w-full items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-primary/90 active:scale-95"
              >
                {role.cta}
              </Link>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
