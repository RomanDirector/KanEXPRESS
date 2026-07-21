'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, ArrowRight } from 'lucide-react'

const ROLES = [
  {
    id: 'seller',
    label: 'Магазин',
    description: 'Продавайте товары онлайн',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-7 h-7">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016 2.993 2.993 0 0 0 2.25-1.016 3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z" />
      </svg>
    ),
  },
  {
    id: 'courier',
    label: 'Курьер',
    description: 'Доставляйте заказы быстро',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-7 h-7">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
      </svg>
    ),
  },
  {
    id: 'warehouse',
    label: 'Партнёр',
    description: 'Управляйте складами и зонами',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-7 h-7">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
      </svg>
    ),
  },
]

export function RegisterForm() {
  const [selectedRole, setSelectedRole] = useState<string | null>(null)
  const [step, setStep] = useState<'role' | 'details'>('role')
  const [form, setForm] = useState({ name: '', email: '', password: '' })

  function handleRoleSelect(id: string) {
    setSelectedRole(id)
    setTimeout(() => setStep('details'), 180)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // TODO: Supabase auth + role insert
  }

  return (
    <div className="w-full max-w-md space-y-8">
      <div className="text-center space-y-1">
        <span className="text-3xl font-black tracking-tighter text-white">
          Kan<span className="text-primary">EXPRESS</span>
        </span>
        <p className="text-sm text-white/40 tracking-widest uppercase">
          {step === 'role' ? 'Выберите роль' : 'Данные аккаунта'}
        </p>
      </div>

      {step === 'role' ? (
        <div className="space-y-3">
          {ROLES.map((role) => (
            <button
              key={role.id}
              onClick={() => handleRoleSelect(role.id)}
              className={[
                'group w-full flex items-center gap-4 rounded-2xl border px-5 py-4 text-left transition-all duration-200',
                selectedRole === role.id
                  ? 'border-primary bg-primary/10 text-white'
                  : 'border-white/10 bg-white/5 text-white/70 hover:border-white/30 hover:bg-white/10 hover:text-white',
              ].join(' ')}
            >
              <span
                className={[
                  'flex-shrink-0 rounded-xl p-2 transition-colors',
                  selectedRole === role.id
                    ? 'bg-primary/20 text-primary'
                    : 'bg-white/5 text-white/40 group-hover:text-white/70',
                ].join(' ')}
              >
                {role.icon}
              </span>
              <div>
                <div className="font-semibold text-base leading-tight">{role.label}</div>
                <div className="text-xs text-white/40 mt-0.5">{role.description}</div>
              </div>
              <ArrowRight className="ml-auto w-4 h-4 flex-shrink-0 text-white/20 group-hover:text-white/40 transition-transform group-hover:translate-x-0.5" />
            </button>
          ))}

          <p className="pt-2 text-center text-sm text-white/30">
            Уже есть аккаунт?{' '}
            <Link href="/login" className="text-primary hover:text-primary/80 transition-colors">
              Войти
            </Link>
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setStep('role')}
            className="border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 rounded-full"
          >
            <ArrowLeft className="mr-1 h-3 w-3" />
            {ROLES.find((r) => r.id === selectedRole)?.label}
          </Button>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wider text-white/40">
                Имя
              </Label>
              <Input
                name="name"
                type="text"
                required
                autoComplete="name"
                placeholder="Ваше имя"
                value={form.name}
                onChange={handleChange}
                className="border-white/10 bg-white/5 text-white placeholder:text-white/20 focus-visible:ring-primary/50"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wider text-white/40">
                Email
              </Label>
              <Input
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={handleChange}
                className="border-white/10 bg-white/5 text-white placeholder:text-white/20 focus-visible:ring-primary/50"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wider text-white/40">
                Пароль
              </Label>
              <Input
                name="password"
                type="password"
                required
                autoComplete="new-password"
                placeholder="Минимум 8 символов"
                value={form.password}
                onChange={handleChange}
                className="border-white/10 bg-white/5 text-white placeholder:text-white/20 focus-visible:ring-primary/50"
              />
            </div>
          </div>

          <Button type="submit" className="w-full mt-2">
            Создать аккаунт
          </Button>

          <p className="text-center text-sm text-white/30">
            Уже есть аккаунт?{' '}
            <Link href="/login" className="text-primary hover:text-primary/80 transition-colors">
              Войти
            </Link>
          </p>
        </form>
      )}
    </div>
  )
}
