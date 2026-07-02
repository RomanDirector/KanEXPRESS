'use client'

import Link from 'next/link'
import { useState } from 'react'

const NAV_LINKS = [
  { href: '/', label: 'Главная' },
  { href: '/tariffs', label: 'Тарифы' },
  { href: '/about', label: 'О нас' },
  { href: '/docs', label: 'Документация' },
  { href: '/contacts', label: 'Контакты' },
]

export function Navbar() {
  const [open, setOpen] = useState(false)

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-gray-100 bg-[#f8f8f8]/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="text-xl font-black tracking-tighter text-gray-900">
          Kan<span className="text-primary">EXPRESS</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm text-gray-400 transition-colors hover:text-gray-900"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-4 md:flex">
          <Link
            href="/login"
            className="text-sm text-gray-400 transition-colors hover:text-gray-900"
          >
            Войти
          </Link>
          <Link
            href="/register"
            className="rounded-full border-2 border-primary px-5 py-2 text-sm font-semibold text-primary transition-all hover:bg-primary hover:text-white"
          >
            Регистрация
          </Link>
        </div>

        {/* Mobile burger */}
        <button
          className="flex flex-col gap-1.5 p-2 md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Меню"
        >
          <span className={`block h-0.5 w-5 bg-gray-900 transition-all ${open ? 'translate-y-2 rotate-45' : ''}`} />
          <span className={`block h-0.5 w-5 bg-gray-900 transition-all ${open ? 'opacity-0' : ''}`} />
          <span className={`block h-0.5 w-5 bg-gray-900 transition-all ${open ? '-translate-y-2 -rotate-45' : ''}`} />
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-gray-100 bg-[#f8f8f8] px-6 py-4 md:hidden">
          <nav className="flex flex-col gap-4">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="text-sm text-gray-500 hover:text-gray-900"
              >
                {l.label}
              </Link>
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t border-gray-100 pt-4">
              <Link href="/login" className="text-center text-sm text-gray-400 hover:text-gray-900">Войти</Link>
              <Link
                href="/register"
                className="rounded-full border-2 border-primary py-2.5 text-center text-sm font-semibold text-primary hover:bg-primary hover:text-white transition-all"
              >
                Регистрация
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
