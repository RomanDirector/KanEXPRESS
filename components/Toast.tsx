'use client'
import { useEffect } from 'react'
import Link from 'next/link'

interface ToastProps {
  message: string
  type: 'error' | 'success'
  onClose: () => void
  // Необязательная ссылка-действие внутри тоста (например, "Открыть Профиль")
  // для случаев, когда решение проблемы требует перехода на другую страницу.
  actionLabel?: string
  actionHref?: string
}

export function Toast({ message, type, onClose, actionLabel, actionHref }: ToastProps) {
  useEffect(() => {
    // Тосту со ссылкой даём больше времени — иначе не успеть кликнуть.
    const timer = setTimeout(onClose, actionHref ? 8000 : 4000)
    return () => clearTimeout(timer)
  }, [onClose, actionHref])

  return (
    <div className={`fixed bottom-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-lg text-white text-sm font-semibold flex items-center gap-3 ${type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>
      <span>{message}</span>
      {actionLabel && actionHref && (
        <Link href={actionHref} className="underline underline-offset-2 whitespace-nowrap hover:no-underline">
          {actionLabel}
        </Link>
      )}
    </div>
  )
}
