'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '📦' },
  { href: '/invoices', label: 'Invoices', icon: '🧾' },
  { href: '/stats', label: 'Statistics', icon: '📊' },
  { href: '/archive', label: 'Archive', icon: '🗄️' },
]

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="flex min-h-screen bg-white dark:bg-gray-950">
      {/* Sidebar */}
      <aside className="w-56 border-r border-gray-200 dark:border-gray-800 flex flex-col py-6 px-4 fixed h-full">
        <div className="mb-8">
          <h1 className="text-xl font-bold text-red-600">KanEXpress</h1>
          <p className="text-xs text-gray-400 mt-1">Seller Panel</p>
        </div>

        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-red-600 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-900'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* Контент */}
      <main className="ml-56 flex-1">
        {children}
      </main>
    </div>
  )
}