'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Navbar } from '@/components/layout/navbar'
import { supabase } from '@/lib/supabase'
import { useLang } from '@/lib/i18n'

export default function ResetPasswordPage() {
  const router = useRouter()
  const { t } = useLang()
  const [sessionReady, setSessionReady] = useState<boolean | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  // Supabase сам разбирает токен восстановления из URL (detectSessionInUrl) и
  // либо уже успел создать сессию к моменту монтирования, либо пришлёт
  // событие PASSWORD_RECOVERY чуть позже — слушаем оба варианта.
  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (mounted && data.session) setSessionReady(true)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return
      if (event === 'PASSWORD_RECOVERY' || session) {
        setSessionReady(true)
      }
    })

    const timeout = setTimeout(() => {
      if (mounted) setSessionReady((prev) => prev ?? false)
    }, 3000)

    return () => {
      mounted = false
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (newPassword.length < 6) {
      setError(t('passwordTooShortMsg'))
      return
    }
    if (newPassword !== confirmPassword) {
      setError(t('passwordsMismatchMsg'))
      return
    }

    setSaving(true)
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
    setSaving(false)

    if (updateError) {
      setError(t('resetPasswordErrorPrefix') + updateError.message)
      return
    }

    setSuccess(true)
  }

  return (
    <div className="min-h-screen bg-[#f8f8f8]">
      <Navbar />

      <main className="flex min-h-screen items-center justify-center px-4 pt-16">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <p className="text-xs uppercase tracking-widest text-gray-400 mb-3">{t('resetPasswordTitle')}</p>
            <h1 className="text-3xl font-light tracking-tight text-gray-900">{t('resetPasswordTitle')}</h1>
            <p className="mt-2 text-sm text-gray-400">{t('resetPasswordSubtitle')}</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-8 space-y-5">
            {success ? (
              <div className="space-y-5 text-center">
                <p className="text-sm text-green-600">{t('resetPasswordSuccessMsg')}</p>
                <Button onClick={() => router.push('/login')} className="w-full rounded-full py-6 text-base font-semibold">
                  {t('resetPasswordGoToLoginBtn')}
                </Button>
              </div>
            ) : sessionReady === false ? (
              <div className="space-y-5 text-center">
                <p className="text-sm text-destructive">{t('resetPasswordInvalidLinkMsg')}</p>
                <Link href="/login" className="text-sm text-primary font-medium hover:underline">
                  {t('resetPasswordGoToLoginBtn')}
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-500 uppercase tracking-wide">{t('newPasswordLabel')}</Label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    disabled={sessionReady === null}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-500 uppercase tracking-wide">{t('confirmPasswordLabel')}</Label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    disabled={sessionReady === null}
                  />
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <Button
                  type="submit"
                  disabled={saving || sessionReady === null}
                  className="w-full rounded-full py-6 text-base font-semibold"
                >
                  {saving ? t('resetPasswordSavingLabel') : t('resetPasswordSubmitBtn')}
                </Button>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
