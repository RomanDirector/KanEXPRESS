'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  Store,
  Map,
  PackageSearch,
  Archive,
  Ban,
  ShieldCheck,
  MapPinned,
  CreditCard,
  RotateCcw,
  User,
  KeyRound,
  Menu,
} from 'lucide-react'
import { supabase, signOutAndRedirect } from '@/lib/supabase'
import { Spinner } from '@/components/ui/spinner'

const navItems = [
  { href: '/admin', label: 'Дашборд', icon: LayoutDashboard },
  { href: '/admin/couriers', label: 'Курьеры', icon: Users },
  { href: '/admin/sellers', label: 'Продавцы', icon: Store },
  { href: '/admin/map', label: 'Карта', icon: Map },
  { href: '/admin/orders', label: 'Заказы', icon: PackageSearch },
  { href: '/admin/archive', label: 'Архив', icon: Archive },
  { href: '/admin/cancelled', label: 'Отменённые', icon: Ban },
  { href: '/admin/access', label: 'Доступ', icon: ShieldCheck },
  { href: '/admin/zones', label: 'Зоны', icon: MapPinned },
  { href: '/admin/subscriptions', label: 'Подписки', icon: CreditCard },
  { href: '/admin/returns', label: 'Возвраты', icon: RotateCcw },
  { href: '/admin/geocode-keys', label: 'Ключи геокодера', icon: KeyRound },
  { href: '/admin/profile', label: 'Профиль', icon: User },
]

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname()

  const handleLogout = async () => {
    await signOutAndRedirect()
  }

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/40 z-30 md:hidden" onClick={onClose} />}
      <aside
        className={`w-60 bg-white border-r border-gray-200 flex flex-col py-6 px-4 fixed h-full shadow-sm z-40 transition-transform duration-200 md:translate-x-0 overflow-y-auto ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-6 px-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black tracking-tight">
              <span className="text-red-600">Kan</span>
              <span className="text-gray-900">EXPRESS</span>
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1 font-medium uppercase tracking-wider">Админ-панель</p>
        </div>

        <nav className="flex flex-col gap-1 flex-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-red-600 text-white shadow-md shadow-red-200'
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="px-2">
          <button
            onClick={handleLogout}
            className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-all mb-2"
          >
            Выйти
          </button>
          <div className="bg-red-50 rounded-xl p-3 border border-red-100">
            <p className="text-xs font-bold text-red-600">KanExpress</p>
            <p className="text-xs text-gray-400 mt-0.5">Внутренняя админ-панель</p>
          </div>
        </div>
      </aside>
    </>
  )
}

function MobileHeader({ onOpen }: { onOpen: () => void }) {
  return (
    <header className="md:hidden flex items-center gap-3 bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-20">
      <button onClick={onOpen} className="p-2 -ml-2 rounded-lg text-gray-600 hover:bg-gray-100" aria-label="Открыть меню">
        <Menu size={22} />
      </button>
      <span className="text-lg font-black tracking-tight">
        <span className="text-red-600">Kan</span>
        <span className="text-gray-900">EXPRESS</span>
      </span>
    </header>
  )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

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

      const { data: admin, error } = await supabase
        .from('admins')
        .select('id')
        .eq('id', user.id)
        .maybeSingle()

      if (cancelled) return

      if (error || !admin) {
        router.push('/login')
        return
      }

      setChecking(false)
    }

    checkAuth()

    return () => {
      cancelled = true
    }
  }, [router])

  if (checking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 min-h-screen flex flex-col md:ml-60">
        <MobileHeader onOpen={() => setSidebarOpen(true)} />
        <main className="flex-1 bg-gray-50">{children}</main>
      </div>
    </div>
  )
}
