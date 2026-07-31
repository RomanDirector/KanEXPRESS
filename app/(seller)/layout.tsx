'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, FileText, BarChart2, Archive, Users, Map, Navigation, MapPinned, TrendingDown, Ban, User, Box, ScanLine, Menu } from 'lucide-react'
import { LangProvider, useLang } from '@/lib/i18n'
import { supabase } from '@/lib/supabase'
import { SellerContext, useSeller, type SellerProfile } from '@/lib/seller-context'
import { Spinner } from '@/components/ui/spinner'

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname()
  const router = useRouter()
  const { lang, setLang, t } = useLang()
  const seller = useSeller()

  const navItems = [
    { href: '/dashboard',       label: t('dashboard'),     icon: LayoutDashboard },
    { href: '/invoices',        label: t('invoices'),      icon: FileText },
    { href: '/orders-map',      label: t('map'),           icon: Map },
    { href: '/delivery-zones',  label: t('deliveryZones'), icon: MapPinned },
    { href: '/boxes',           label: t('boxesNav'),      icon: Box },
    { href: '/scan',            label: t('scanNav'),       icon: ScanLine },
    { href: '/tracking',        label: t('tracking'),      icon: Navigation },
    { href: '/demping',         label: t('demping'),       icon: TrendingDown },
    { href: '/stats',           label: t('stats'),         icon: BarChart2 },
    { href: '/staff',           label: t('staff'),         icon: Users },
    { href: '/archive',         label: t('archive'),       icon: Archive },
    { href: '/cancelled',       label: t('cancelled'),     icon: Ban },
    { href: '/profile',         label: t('profileNav'),   icon: User },
  ]

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`w-60 bg-white border-r border-gray-200 flex flex-col py-6 px-4 fixed h-full shadow-sm z-40 transition-transform duration-200 md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
      {/* Лого */}
      <div className="mb-6 px-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-black tracking-tight">
            <span className="text-red-600">Kan</span>
            <span className="text-gray-900">EXPRESS</span>
          </span>
          {seller.company_logo_url && (
            <img
              src={seller.company_logo_url}
              alt=""
              className="h-7 object-contain"
            />
          )}
        </div>
        <p className="text-xs text-gray-400 mt-1 font-medium uppercase tracking-wider">{t('sellerPanel')}</p>
      </div>

      {/* Переключатель языка */}
      <div className="flex gap-1 mb-5 px-2">
        {(['ru', 'kz'] as const).map((l) => (
          <button
            key={l}
            onClick={() => setLang(l)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
              lang === l
                ? 'bg-red-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
            }`}
          >
            {l === 'ru' ? 'Рус' : 'Қаз'}
          </button>
        ))}
      </div>

      {/* Навигация */}
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

      {/* Низ sidebar */}
      <div className="px-2">
        <div className="bg-red-50 rounded-xl p-3 border border-red-100">
          <p className="text-xs font-bold text-red-600">KanExpress</p>
          <p className="text-xs text-gray-400 mt-0.5">Logistics for Kaspi.kz</p>
        </div>
      </div>
      </aside>
    </>
  )
}

// Проверка сессии + загрузка профиля продавца из sellers, как в app/(courier)/layout.tsx.
function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [seller, setSeller] = useState<SellerProfile | null>(null)
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

      const { data: sellerProfile, error } = await supabase
        .from('sellers')
        .select('id, full_name, phone, email, organization_name, organization_address, kaspi_token, kaspi_shop_id, created_at, company_logo_url')
        .eq('id', user.id)
        .maybeSingle()

      if (cancelled) return

      if (error || !sellerProfile) {
        router.push('/login')
        return
      }

      setSeller(sellerProfile as SellerProfile)
      setChecking(false)
    }

    checkAuth()

    return () => {
      cancelled = true
    }
  }, [router])

  if (checking || !seller) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    )
  }

  return <SellerContext.Provider value={seller}>{children}</SellerContext.Provider>
}

function MobileHeader({ onOpen }: { onOpen: () => void }) {
  const { t } = useLang()
  return (
    <header className="md:hidden flex items-center gap-3 bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-20">
      <button
        onClick={onOpen}
        className="p-2 -ml-2 rounded-lg text-gray-600 hover:bg-gray-100"
        aria-label={t('openMenuLabel')}
      >
        <Menu size={22} />
      </button>
      <span className="text-lg font-black tracking-tight">
        <span className="text-red-600">Kan</span>
        <span className="text-gray-900">EXPRESS</span>
      </span>
    </header>
  )
}

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <LangProvider>
      <AuthGuard>
        <div className="flex min-h-screen bg-gray-50">
          <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          <div className="flex-1 min-h-screen flex flex-col md:ml-60">
            <MobileHeader onOpen={() => setSidebarOpen(true)} />
            <main className="flex-1 bg-gray-50">
              {children}
            </main>
          </div>
        </div>
      </AuthGuard>
    </LangProvider>
  )
}