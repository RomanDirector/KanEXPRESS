import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Navbar } from '@/components/layout/navbar'

export default function LoginPage() {
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
            <form className="space-y-5">
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-500 uppercase tracking-wide">Email</Label>
                <Input type="email" placeholder="you@example.com" />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-gray-500 uppercase tracking-wide">Пароль</Label>
                  <a href="#" className="text-xs text-gray-400 hover:text-primary transition-colors">
                    Забыли пароль?
                  </a>
                </div>
                <Input type="password" placeholder="••••••••" />
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 accent-primary cursor-pointer"
                />
                <span className="text-sm text-gray-400">Запомнить меня</span>
              </label>

              <Button type="submit" className="w-full rounded-full py-6 text-base font-semibold">
                Войти
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
