'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Map, BarChart2, User, LogOut, Ban } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { CourierContext, type CourierProfile } from '@/lib/courier-context'
import { Spinner } from '@/components/ui/spinner'

const navItems = [
  { href: '/courier-dashboard', label: 'Мои заказы', icon: LayoutDashboard },
  { href: '/courier-map', label: 'Карта', icon: Map },
  { href: '/courier-stats', label: 'Статистика', icon: BarChart2 },
  { href: '/courier-cancelled', label: 'Отменённые', icon: Ban },
  { href: '/courier-profile', label: 'Профиль', icon: User },
]

export default function CourierLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [courier, setCourier] = useState<CourierProfile | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function checkAuth() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const { data: courierProfile, error } = await supabase
        .from('couriers')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      if (cancelled) return

      if (error || !courierProfile) {
        router.push('/login')
        return
      }

      setCourier(courierProfile as CourierProfile)
      setChecking(false)
    }

    checkAuth()

    return () => {
      cancelled = true
    }
  }, [router])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (checking || !courier) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    )
  }

  return (
    <CourierContext.Provider value={courier}>
      <div className="flex min-h-screen bg-secondary">
        {/* Sidebar */}
        <aside className="w-60 bg-card border-r border-border flex flex-col py-6 px-4 fixed h-full shadow-sm">

          <div className="mb-8 px-2">
            <span className="text-2xl font-black tracking-tight">
              <span className="text-primary">Kan</span>
              <span className="text-foreground">EXPRESS</span>
            </span>
            <p className="text-xs text-muted-foreground mt-1 font-medium uppercase tracking-wider">Кабинет курьера</p>
            <p className="text-sm text-foreground mt-3 font-semibold truncate">{courier.full_name}</p>
          </div>

          <nav className="flex flex-col gap-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>

          <div className="mt-auto px-2 space-y-3">
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-all duration-200"
            >
              <LogOut size={18} />
              <span>Выйти</span>
            </button>

            <div className="bg-primary/10 rounded-xl p-3">
              <p className="text-xs font-semibold text-primary">KanExpress</p>
              <p className="text-xs text-muted-foreground mt-0.5">Logistics for Kaspi.kz</p>
            </div>
          </div>
        </aside>

        <main className="ml-60 flex-1 min-h-screen">
          {children}
        </main>
      </div>
    </CourierContext.Provider>
  )
}
