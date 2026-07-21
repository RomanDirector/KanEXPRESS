'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Navbar } from '@/components/layout/navbar'

export default function RegisterPartnerPage() {
  const [form, setForm] = useState({
    phone: '', email: '', firstName: '', lastName: '',
    middleName: '', password: '', confirmPassword: '',
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function handlePhone(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 11)
    let f = ''
    if (digits.length > 0) f = '+7'
    if (digits.length > 1) f += ' (' + digits.slice(1, 4)
    if (digits.length > 4) f += ') ' + digits.slice(4, 7)
    if (digits.length > 7) f += '-' + digits.slice(7, 9)
    if (digits.length > 9) f += '-' + digits.slice(9, 11)
    setForm(prev => ({ ...prev, phone: f }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // TODO: логика отправки
  }

  return (
    <div className="min-h-screen bg-[#f8f8f8]">
      <Navbar />

      <main className="mx-auto max-w-6xl px-6 pt-28 pb-16">
        <div className="flex gap-8 items-start">

          {/* Левая колонка — форма */}
          <div className="flex-1 bg-white rounded-2xl shadow-sm p-8">
            <div className="mb-1">
              <Link href="/register" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">← Выбор роли</Link>
            </div>
            <h1 className="text-2xl font-light tracking-tight text-gray-900 mt-2">Регистрация партнёра</h1>
            <p className="mt-1 text-sm text-gray-400">
              Уже зарегистрированы?{' '}
              <Link href="/login" className="text-primary hover:underline font-medium">Войти</Link>
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-6">
              <div className="grid grid-cols-2 gap-4">

                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-500 uppercase tracking-wide">Номер телефона *</Label>
                  <Input name="phone" value={form.phone} onChange={handlePhone} placeholder="+7 (___) ___-__-__" required />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-500 uppercase tracking-wide">Email</Label>
                  <Input type="email" name="email" value={form.email} onChange={handleChange} placeholder="you@example.com" />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-500 uppercase tracking-wide">Имя</Label>
                  <Input name="firstName" value={form.firstName} onChange={handleChange} placeholder="Имя" />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-500 uppercase tracking-wide">Фамилия</Label>
                  <Input name="lastName" value={form.lastName} onChange={handleChange} placeholder="Фамилия" />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-500 uppercase tracking-wide">Отчество</Label>
                  <Input name="middleName" value={form.middleName} onChange={handleChange} placeholder="Введите ваше отчество (если есть)" />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-500 uppercase tracking-wide">Пароль</Label>
                  <Input type="password" name="password" value={form.password} onChange={handleChange} placeholder="Минимум 8 символов" />
                </div>

                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs text-gray-500 uppercase tracking-wide">Подтвердите пароль</Label>
                  <Input type="password" name="confirmPassword" value={form.confirmPassword} onChange={handleChange} placeholder="Повторите пароль" />
                </div>
              </div>

              <Button type="submit" className="w-full rounded-full py-6 text-base font-semibold">
                Стать партнёром
              </Button>
            </form>
          </div>

          {/* Правая колонка — тёмная sticky карточка */}
          <div className="w-80 shrink-0 bg-[#0a0a0a] rounded-2xl p-8 sticky top-24 text-white">
            <h2 className="text-lg font-light tracking-tight">Преимущества для партнёров</h2>
            <div className="mt-6 space-y-5">
              {[
                'Простая интеграция по промокоду.',
                'Единоразовая выплата за каждый привлечённый магазин после выполнения цели.',
                'Удобная панель мониторинга активности.',
                'Моментальные оповещения о новых магазинах.',
              ].map((text, i) => (
                <div key={i} className="flex gap-3">
                  <span className="mt-0.5 text-primary text-xs font-bold shrink-0">0{i + 1}</span>
                  <p className="text-sm text-white/60 leading-relaxed">{text}</p>
                </div>
              ))}
            </div>
            <div className="mt-8 border-t border-white/10 pt-6 space-y-3">
              <Link href="/register/seller" className="flex w-full items-center justify-center rounded-full border border-white/30 px-4 py-2.5 text-sm text-white/70 transition-all hover:border-primary hover:text-primary">
                Регистрация магазина
              </Link>
              <Link href="/register-courier" className="flex w-full items-center justify-center rounded-full border border-white/30 px-4 py-2.5 text-sm text-white/70 transition-all hover:border-primary hover:text-primary">
                Стать курьером
              </Link>
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}
