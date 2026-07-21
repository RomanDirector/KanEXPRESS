'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Navbar } from '@/components/layout/navbar'
import { supabase } from '@/lib/supabase'
import { getPendingRegistration, clearPendingRegistration } from '@/lib/pending-registration'
import { ensureProfileExists } from '@/lib/ensure-profile'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError || !data.user) {
      setLoading(false)
      setError(signInError?.message ?? 'Не удалось войти')
      return
    }

    const userId = data.user.id

    const { data: courier } = await supabase
      .from('couriers')
      .select('id')
      .eq('id', userId)
      .maybeSingle()

    if (courier) {
      router.push('/courier-dashboard')
      return
    }

    const { data: seller } = await supabase
      .from('sellers')
      .select('id')
      .eq('id', userId)
      .maybeSingle()

    if (seller) {
      router.push('/dashboard')
      return
    }

    // Профиля нет ни в одной из таблиц — это ожидаемо, если пользователь
    // подтвердил email не сразу: signUp создал auth-пользователя, но insert
    // в couriers/sellers тогда не прошёл бы (не было сессии для RLS).
    // Черновик анкеты лежит в pending_registrations (не в localStorage) —
    // сработает даже если регистрировались с другого устройства.
    const pending = await getPendingRegistration(supabase, userId)

    if (!pending) {
      setLoading(false)
      setError('Регистрация не завершена, пройдите её заново')
      return
    }

    const result = await ensureProfileExists(supabase, userId, pending.data.role, pending.data)

    if (!result.success) {
      setLoading(false)
      setError(result.error)
      return
    }

    await clearPendingRegistration(supabase, pending.id)

    setLoading(false)
    router.push(pending.data.role === 'courier' ? '/courier-dashboard' : '/dashboard')
  }

  return (
    <div className="min-h-screen bg-[#f8f8f8]">
      <Navbar />

      <main className="flex min-h-screen items-center justify-center px-4 pt-16">
        <div className="w-full max-w-md">

          {/* Заголовок */}
          <div className="mb-8 text-center">
            <p className="text-xs uppercase tracking-widest text-gray-400 mb-3">Вход в систему</p>
            <h1 className="text-3xl font-light tracking-tight text-gray-900">Добро пожаловать</h1>
            <p className="mt-2 text-sm text-gray-400">Войдите, чтобы управлять вашим аккаунтом</p>
          </div>

          {/* Карточка формы */}
          <div className="bg-white rounded-2xl shadow-sm p-8 space-y-5">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-500 uppercase tracking-wide">Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-gray-500 uppercase tracking-wide">Пароль</Label>
                  <a href="#" className="text-xs text-gray-400 hover:text-primary transition-colors">
                    Забыли пароль?
                  </a>
                </div>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 accent-primary cursor-pointer"
                />
                <span className="text-sm text-gray-400">Запомнить меня</span>
              </label>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button type="submit" disabled={loading} className="w-full rounded-full py-6 text-base font-semibold">
                {loading ? 'Входим...' : 'Войти'}
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-100" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-3 text-xs text-gray-300">или</span>
              </div>
            </div>

            <p className="text-center text-sm text-gray-400">
              Нет аккаунта?{' '}
              <Link href="/register" className="text-primary font-medium hover:underline">
                Зарегистрироваться
              </Link>
            </p>
          </div>

          <p className="mt-6 text-center text-xs text-gray-300">
            © 2025 KanExpress. Логистика для Kaspi.kz
          </p>
        </div>
      </main>
    </div>
  )
}
