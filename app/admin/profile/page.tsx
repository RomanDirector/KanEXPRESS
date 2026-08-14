'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function AdminProfilePage() {
  const [email, setEmail] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changing, setChanging] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null))
  }, [])

  async function changePassword() {
    setMsg(null)
    if (newPassword.length < 6) {
      setMsg({ type: 'error', text: 'Пароль должен быть не короче 6 символов' })
      return
    }
    if (newPassword !== confirmPassword) {
      setMsg({ type: 'error', text: 'Пароли не совпадают' })
      return
    }
    setChanging(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setChanging(false)
    if (error) {
      console.error(error)
      setMsg({ type: 'error', text: 'Ошибка: ' + error.message })
      return
    }
    setMsg({ type: 'success', text: 'Пароль изменён' })
    setNewPassword('')
    setConfirmPassword('')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-4 md:px-8 py-5">
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Профиль</h1>
        <p className="text-sm text-gray-400 mt-0.5">Учётная запись администратора</p>
      </header>

      <main className="px-4 md:px-8 py-6 max-w-md mx-auto space-y-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 mb-3">Аккаунт</h2>
          <p className="text-xs text-gray-400 mb-1">Email</p>
          <p className="text-sm font-semibold text-gray-900">{email || '—'}</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 mb-4">Смена пароля</h2>
          <div className="space-y-3 mb-4">
            <div>
              <p className="text-xs text-gray-400 mb-1">Новый пароль</p>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
              />
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Подтверждение пароля</p>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
              />
            </div>
          </div>
          {msg && (
            <p className={`text-sm mb-3 ${msg.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>{msg.text}</p>
          )}
          <button
            onClick={changePassword}
            disabled={changing}
            className="px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-all"
          >
            {changing ? 'Сохранение...' : 'Изменить пароль'}
          </button>
        </div>
      </main>
    </div>
  )
}
