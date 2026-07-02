'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, FileText, BarChart2, Archive, Users } from 'lucide-react'
import { LangProvider, useLang } from '@/lib/i18n'

function Sidebar() {
  const pathname = usePathname()
  const { lang, setLang, t } = useLang()

  const navItems = [
    { href: '/dashboard', label: t('dashboard'), icon: LayoutDashboard },
    { href: '/invoices', label: t('invoices'), icon: FileText },
    { href: '/stats', label: t('stats'), icon: BarChart2 },
    { href: '/staff', label: t('staff'), icon: Users },
    { href: '/archive', label: t('archive'), icon: Archive },
  ]

  return (
    <aside className="w-60 bg-white border-r border-gray-200 flex flex-col py-6 px-4 fixed h-full shadow-sm">
      {/* Лого */}
      <div className="mb-6 px-2">
        <span className="text-2xl font-black tracking-tight">
          <span className="text-red-600">Kan</span>
          <span className="text-gray-900">EXPRESS</span>
        </span>
        <p className="text-xs text-gray-400 mt-1 font-medium uppercase tracking-wider">{t('sellerPanel')}</p>
      </div>

      {/* Переключатель языка */}
      <div className="flex gap-1 mb-6 px-2">
        {(['ru', 'kz'] as const).map((l) => (
          <button
            key={l}
            onClick={() => setLang(l)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
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

      {/* Низ */}
      <div className="mt-auto px-2">
        <div className="bg-red-50 rounded-xl p-3">
          <p className="text-xs font-semibold text-red-600">KanEXpress</p>
          <p className="text-xs text-gray-400 mt-0.5">Logistics for Kaspi.kz</p>
        </div>
      </div>
    </aside>
  )
}

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  return (
    <LangProvider>
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <main className="ml-60 flex-1 min-h-screen bg-gray-50">
          {children}
        </main>
      </div>
    </LangProvider>
  )
}