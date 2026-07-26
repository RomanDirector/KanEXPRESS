'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Navbar } from '@/components/layout/navbar'
import { supabase, waitForActiveSession } from '@/lib/supabase'
import { savePendingRegistration } from '@/lib/pending-registration'

export default function RegisterSellerPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    phone: '', email: '', firstName: '', lastName: '',
    orgName: '', orgAddress: '', kaspiToken: '', kaspiShopId: '',
    promoCode: '', password: '', confirmPassword: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
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
    setError('')

    if (form.password !== form.confirmPassword) {
      setError('Пароли не совпадают')
      return
    }

    setLoading(true)

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    })

    if (signUpError || !data.user) {
      setLoading(false)
      setError(signUpError?.message ?? 'Не удалось создать аккаунт')
      return
    }

    const profileData = {
      role: 'seller' as const,
      organization_name: form.orgName,
      phone: form.phone,
      full_name: `${form.firstName} ${form.lastName}`.trim(),
      organization_address: form.orgAddress,
      kaspi_token: form.kaspiToken,
      kaspi_shop_id: form.kaspiShopId,
    }

    if (!data.session) {
      // Сессии ещё нет — почта не подтверждена. Insert прямо сейчас упрётся в RLS
      // (auth.uid() == null), поэтому откладываем данные в pending_registrations до логина.
      const pendingError = await savePendingRegistration(supabase, data.user.id, profileData)
      setLoading(false)
      if (pendingError) {
        // Аккаунт в auth.users уже создан (signUp() отработал успешно) — просто
        // не удалось сохранить черновик анкеты. Не пугаем технической ошибкой,
        // войти можно и без него, ensureProfileExists досоздаст профиль при логине.
        setError('Не удалось завершить регистрацию, попробуйте войти — мы доделаем её автоматически')
        return
      }
      setError(
        'Мы отправили письмо для подтверждения почты. Подтвердите её и войдите — профиль магазина будет создан автоматически.',
      )
      return
    }

    // signUp() уже вернул session, insert можно делать сразу — но на всякий случай
    // (гонка между resolve промиса и записью токена в клиент) даём короткое окно.
    const confirmedSession = await waitForActiveSession(supabase, 5000)

    if (!confirmedSession) {
      setLoading(false)
      setError('Не удалось завершить регистрацию, попробуйте войти вручную')
      return
    }

    // id записи в sellers должен совпадать с id из auth.users,
    // чтобы после логина профиль искался одним запросом по id текущего пользователя
    const { role: _role, ...sellerFields } = profileData
    const { error: insertError } = await supabase.from('sellers').insert({
      id: data.user.id,
      ...sellerFields,
    })

    setLoading(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-[#f8f8f8]">
      <Navbar />

      <main className="mx-auto max-w-6xl px-6 pt-28 pb-16">
        <div className="flex gap-8 items-start">

          {/* Левая колонка — форма */}
          <div className="flex-1 bg-white rounded-2xl shadow-sm p-8">
            <div className="flex items-center gap-3 mb-1">
              <Link href="/register" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">← Выбор роли</Link>
            </div>
            <h1 className="text-2xl font-light tracking-tight text-gray-900 mt-2">Данные магазина</h1>
            <p className="mt-1 text-sm text-gray-400">
              Уже есть аккаунт?{' '}
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
                  <Label className="text-xs text-gray-500 uppercase tracking-wide">Название организации</Label>
                  <Input name="orgName" value={form.orgName} onChange={handleChange} placeholder="ИП Иванов" />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-500 uppercase tracking-wide">Kaspi Token</Label>
                  <Input name="kaspiToken" value={form.kaspiToken} onChange={handleChange} placeholder="Токен из Kaspi Merchant" />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-500 uppercase tracking-wide">Kaspi Shop ID</Label>
                  <Input name="kaspiShopId" value={form.kaspiShopId} onChange={handleChange} placeholder="ID магазина" />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-500 uppercase tracking-wide">Промокод партнёра</Label>
                  <Input name="promoCode" value={form.promoCode} onChange={handleChange} placeholder="Если есть" />
                </div>

                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs text-gray-500 uppercase tracking-wide">Адрес организации</Label>
                  <textarea
                    name="orgAddress" value={form.orgAddress} onChange={handleChange}
                    placeholder="Город, улица, дом" rows={2}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                  />
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

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button type="submit" disabled={loading} className="w-full rounded-full py-6 text-base font-semibold">
                {loading ? 'Создаём аккаунт...' : 'Зарегистрировать магазин'}
              </Button>
            </form>
          </div>

          {/* Правая колонка — тёмная sticky карточка */}
          <div className="w-80 shrink-0 bg-[#0a0a0a] rounded-2xl p-8 sticky top-24 text-white">
            <h2 className="text-lg font-light tracking-tight">Подключение к Kaspi</h2>
            <div className="mt-6 space-y-5">
              {[
                'Синхронизация новых заказов каждые 10 минут.',
                'Автоматическое обновление статусов доставки.',
                'Единая история заказов и событий.',
                'Поддержка локальной доставки и самовывоза.',
              ].map((text, i) => (
                <div key={i} className="flex gap-3">
                  <span className="mt-0.5 text-primary text-xs font-bold shrink-0">0{i + 1}</span>
                  <p className="text-sm text-white/60 leading-relaxed">{text}</p>
                </div>
              ))}
            </div>
            <div className="mt-8 border-t border-white/10 pt-6 space-y-3">
              <Link href="/register-courier" className="flex w-full items-center justify-center rounded-full border border-white/30 px-4 py-2.5 text-sm text-white/70 transition-all hover:border-primary hover:text-primary">
                Регистрация курьера
              </Link>
              <Link href="/register-partner" className="flex w-full items-center justify-center rounded-full border border-white/30 px-4 py-2.5 text-sm text-white/70 transition-all hover:border-primary hover:text-primary">
                Стать партнёром
              </Link>
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}
