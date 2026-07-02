'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, FileText, BarChart2, Archive } from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/invoices', label: 'Invoices', icon: FileText },
  { href: '/stats', label: 'Statistics', icon: BarChart2 },
  { href: '/archive', label: 'Archive', icon: Archive },
]

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="flex min-h-screen bg-secondary">
      {/* Sidebar */}
      <aside className="w-60 bg-card border-r border-border flex flex-col py-6 px-4 fixed h-full shadow-sm">

        <div className="mb-8 px-2">
          <span className="text-2xl font-black tracking-tight">
            <span className="text-primary">Kan</span>
            <span className="text-foreground">EXPRESS</span>
          </span>
          <p className="text-xs text-muted-foreground mt-1 font-medium uppercase tracking-wider">Seller Panel</p>
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

        <div className="mt-auto px-2">
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
  )
}
