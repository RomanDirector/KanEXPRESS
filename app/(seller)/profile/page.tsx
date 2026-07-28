'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LogOut, Crown, Check, Pencil, ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface SellerData {
  full_name: string
  phone: string
  email: string | null
  organization_name: string
  organization_address: string
  notifications_enabled: boolean
}

interface SubscriptionData {
  plan: 'free' | 'pro'
  expires_at: string | null
  cancel_at_period_end: boolean
}

interface PaymentRow {
  id: string
  amount: number
  plan: string
  status: string
  created_at: string
}

type EditableFields = 'full_name' | 'phone' | 'organization_name' | 'organization_address'

const EDIT_FIELDS: { key: EditableFields; label: string }[] = [
  { key: 'full_name', label: 'ФИО' },
  { key: 'phone', label: 'Телефон' },
  { key: 'organization_name', label: 'Организация' },
  { key: 'organization_address', label: 'Адрес организации' },
]

function getInitials(fullName: string | undefined | null) {
  if (!fullName) return '?'
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  const initials = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() || '').join('')
  return initials || '?'
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('ru-RU')
}

export default function ProfilePage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [seller, setSeller] = useState<SellerData | null>(null)
  const [subscription, setSubscription] = useState<SubscriptionData>({
    plan: 'free',
    expires_at: null,
    cancel_at_period_end: false,
  })
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [loading, setLoading] = useState(true)

  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState<Record<EditableFields, string>>({
    full_name: '',
    phone: '',
    organization_name: '',
    organization_address: '',
  })
  const [savingProfile, setSavingProfile] = useState(false)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [changingPassword, setChangingPassword] = useState(false)

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      return
    }

    setUserId(user.id)

    const [
      { data: sellerData, error: sellerErr },
      { data: subData, error: subErr },
      { data: paymentsData, error: paymentsErr },
    ] = await Promise.all([
      supabase
        .from('sellers')
        .select('full_name, phone, email, organization_name, organization_address, notifications_enabled')
        .eq('id', user.id)
        .single(),
      supabase
        .from('seller_subscriptions')
        .select('plan, expires_at, cancel_at_period_end')
        .eq('seller_id', user.id)
        .maybeSingle(),
      supabase
        .from('payment_history')
        .select('*')
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false }),
    ])

    if (sellerErr) console.error(sellerErr)
    if (subErr) console.error(subErr)
    if (paymentsErr) console.error(paymentsErr)

    setSeller(sellerData as SellerData)
    setSubscription({
      plan: subData?.plan === 'pro' ? 'pro' : 'free',
      expires_at: subData?.expires_at ?? null,
      cancel_at_period_end: subData?.cancel_at_period_end ?? false,
    })
    setPayments((paymentsData || []) as PaymentRow[])
    setLoading(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  function startEditing() {
    if (!seller) return
    setEditForm({
      full_name: seller.full_name || '',
      phone: seller.phone || '',
      organization_name: seller.organization_name || '',
      organization_address: seller.organization_address || '',
    })
    setIsEditing(true)
  }

  function cancelEditing() {
    setIsEditing(false)
  }

  async function saveProfile() {
    if (!userId) return
    setSavingProfile(true)
    const { error } = await supabase.from('sellers').update(editForm).eq('id', userId)
    setSavingProfile(false)
    if (error) {
      console.error(error)
      alert('Ошибка сохранения: ' + error.message)
      return
    }
    setSeller((prev) => (prev ? { ...prev, ...editForm } : prev))
    setIsEditing(false)
  }

  async function cancelSubscription() {
    if (!userId) return
    const dateLabel = formatDate(subscription.expires_at)
    if (!confirm(`Подписка будет действовать до ${dateLabel}, затем перейдёт на Free. Отменить?`)) return

    setSubscription((prev) => ({ ...prev, cancel_at_period_end: true }))
    const { error } = await supabase
      .from('seller_subscriptions')
      .update({ cancel_at_period_end: true })
      .eq('seller_id', userId)
    if (error) {
      console.error(error)
      alert('Ошибка отмены подписки: ' + error.message)
      setSubscription((prev) => ({ ...prev, cancel_at_period_end: false }))
    }
  }

  async function resumeSubscription() {
    if (!userId) return
    setSubscription((prev) => ({ ...prev, cancel_at_period_end: false }))
    const { error } = await supabase
      .from('seller_subscriptions')
      .update({ cancel_at_period_end: false })
      .eq('seller_id', userId)
    if (error) {
      console.error(error)
      alert('Ошибка возобновления подписки: ' + error.message)
      setSubscription((prev) => ({ ...prev, cancel_at_period_end: true }))
    }
  }

  async function toggleNotifications() {
    if (!userId || !seller) return
    const next = !seller.notifications_enabled
    setSeller((prev) => (prev ? { ...prev, notifications_enabled: next } : prev))
    const { error } = await supabase.from('sellers').update({ notifications_enabled: next }).eq('id', userId)
    if (error) {
      console.error(error)
      setSeller((prev) => (prev ? { ...prev, notifications_enabled: !next } : prev))
    }
  }

  async function changePassword() {
    setPasswordMsg(null)
    if (newPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: 'Пароль должен быть не короче 6 символов' })
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'Пароли не совпадают' })
      return
    }
    setChangingPassword(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setChangingPassword(false)
    if (error) {
      console.error(error)
      setPasswordMsg({ type: 'error', text: 'Ошибка: ' + error.message })
      return
    }
    setPasswordMsg({ type: 'success', text: 'Пароль успешно изменён' })
    setNewPassword('')
    setConfirmPassword('')
  }

  function confirmDeleteAccount() {
    alert('Функция удаления аккаунта скоро будет доступна. Обратитесь в поддержку.')
    setShowDeleteModal(false)
    setDeleteConfirmText('')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-8 py-5">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-800 mb-2"
        >
          <ArrowLeft size={16} />
          Назад
        </Link>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-red-600 text-white flex items-center justify-center text-lg font-black shrink-0">
            {getInitials(seller?.full_name)}
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Профиль</h1>
            <p className="text-sm text-gray-400 mt-0.5">Данные вашего аккаунта и подписки</p>
          </div>
        </div>
      </header>

      <main className="px-8 py-6 max-w-3xl mx-auto space-y-6">
        {/* Личные данные */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-900">Личные данные</h2>
            {!loading && !isEditing && (
              <button
                onClick={startEditing}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all"
                title="Редактировать"
              >
                <Pencil size={16} />
              </button>
            )}
          </div>

          {loading ? (
            <p className="text-gray-400 text-sm">Загрузка…</p>
          ) : isEditing ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {EDIT_FIELDS.map((f) => (
                  <div key={f.key}>
                    <p className="text-xs text-gray-400 mb-1">{f.label}</p>
                    <input
                      value={editForm[f.key]}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                    />
                  </div>
                ))}
                <div>
                  <p className="text-xs text-gray-400 mb-1">Email</p>
                  <input
                    value={seller?.email || ''}
                    readOnly
                    className="w-full border border-gray-100 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-400 cursor-not-allowed"
                  />
                  <p className="text-xs text-gray-400 mt-1">Email нельзя изменить</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={saveProfile}
                  disabled={savingProfile}
                  className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-all"
                >
                  {savingProfile ? 'Сохраняю…' : 'Сохранить'}
                </button>
                <button
                  onClick={cancelEditing}
                  disabled={savingProfile}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-all"
                >
                  Отмена
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {EDIT_FIELDS.map((f) => (
                <div key={f.key}>
                  <p className="text-xs text-gray-400 mb-1">{f.label}</p>
                  <p className="text-sm font-semibold text-gray-900">{seller?.[f.key] || '—'}</p>
                </div>
              ))}
              <div>
                <p className="text-xs text-gray-400 mb-1">Email</p>
                <p className="text-sm font-semibold text-gray-900">{seller?.email || '—'}</p>
              </div>
            </div>
          )}
        </div>

        {/* Подписка */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm mb-6">
          <h2 className="text-sm font-bold text-gray-900 mb-4">Подписка</h2>

          <div className="flex items-center gap-3 mb-2">
            <span
              className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-black uppercase tracking-wide ${
                subscription.plan === 'pro'
                  ? 'bg-gradient-to-r from-amber-400 to-red-500 text-white shadow-sm shadow-amber-200'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              {subscription.plan === 'pro' && <Crown size={14} />}
              {subscription.plan === 'pro' ? 'Pro' : 'Free'}
            </span>
            {subscription.plan === 'pro' && (
              <span className="text-sm text-gray-400">Действует до {formatDate(subscription.expires_at)}</span>
            )}
          </div>

          {subscription.plan === 'pro' && subscription.cancel_at_period_end && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 mb-4 mt-3">
              Подписка отменена, действует до {formatDate(subscription.expires_at)}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5 mt-4">
            <div className="rounded-xl border border-gray-100 p-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Free</p>
              <p className="text-sm text-gray-700">Базовые функции</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
              <p className="text-xs font-bold text-amber-600 uppercase tracking-wide mb-2 flex items-center gap-1">
                <Check size={13} /> Pro
              </p>
              <p className="text-sm text-gray-700">Все функции без ограничений</p>
            </div>
          </div>

          {subscription.plan === 'free' && (
            <button
              onClick={() => alert('Скоро будет доступно')}
              className="px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-all"
            >
              Улучшить до Pro
            </button>
          )}

          {subscription.plan === 'pro' && !subscription.cancel_at_period_end && (
            <button
              onClick={cancelSubscription}
              className="px-4 py-2.5 rounded-xl border border-red-300 text-red-600 text-sm font-semibold hover:bg-red-50 transition-all"
            >
              Отменить подписку
            </button>
          )}

          {subscription.plan === 'pro' && subscription.cancel_at_period_end && (
            <button
              onClick={resumeSubscription}
              className="px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-all"
            >
              Возобновить подписку
            </button>
          )}
        </div>

        {/* История платежей */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm mb-6">
          <h2 className="text-sm font-bold text-gray-900 mb-4">История платежей</h2>
          {payments.length === 0 ? (
            <p className="text-gray-400 text-sm">Платежей пока нет</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-gray-100 text-gray-400 text-xs uppercase">
                    <th className="py-2 pr-4">Дата</th>
                    <th className="py-2 pr-4">План</th>
                    <th className="py-2 pr-4">Сумма</th>
                    <th className="py-2 pr-4">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b border-gray-50">
                      <td className="py-2.5 pr-4 text-gray-500">{formatDate(p.created_at)}</td>
                      <td className="py-2.5 pr-4 font-semibold text-gray-900 capitalize">{p.plan}</td>
                      <td className="py-2.5 pr-4 font-semibold text-gray-900">
                        {Number(p.amount).toLocaleString('ru-RU')} ₸
                      </td>
                      <td className="py-2.5 pr-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            p.status === 'completed'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Настройки */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm mb-6">
          <h2 className="text-sm font-bold text-gray-900 mb-4">Настройки</h2>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-700">Получать уведомления о заказах</p>
            <button
              onClick={toggleNotifications}
              disabled={!seller}
              className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
                seller?.notifications_enabled ? 'bg-red-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform shadow ${
                  seller?.notifications_enabled ? 'translate-x-5' : ''
                }`}
              />
            </button>
          </div>
        </div>

        {/* Безопасность */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm mb-6">
          <h2 className="text-sm font-bold text-gray-900 mb-4">Безопасность</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
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
          {passwordMsg && (
            <p className={`text-sm mb-3 ${passwordMsg.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
              {passwordMsg.text}
            </p>
          )}
          <button
            onClick={changePassword}
            disabled={changingPassword}
            className="px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-all"
          >
            {changingPassword ? 'Сохраняю…' : 'Сменить пароль'}
          </button>
        </div>

        {/* Опасная зона */}
        <div className="bg-red-50 rounded-2xl border border-red-200 p-6 shadow-sm mb-6">
          <h2 className="text-sm font-bold text-red-700 mb-2">Опасная зона</h2>
          <p className="text-sm text-red-600 mb-4">Удаление аккаунта необратимо и приведёт к потере всех данных.</p>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-all"
          >
            Удалить аккаунт
          </button>
        </div>

        {/* Выход */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 transition-all"
        >
          <LogOut size={16} />
          Выйти
        </button>
      </main>

      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => {
            setShowDeleteModal(false)
            setDeleteConfirmText('')
          }}
        >
          <div
            className="bg-white rounded-2xl p-6 w-96 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold mb-2 text-gray-900">Удалить аккаунт</h3>
            <p className="text-sm text-gray-600 mb-4">
              Это действие необратимо. Чтобы подтвердить, введите слово <b>DELETE</b> ниже.
            </p>
            <input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-red-400"
            />
            <div className="flex gap-2">
              <button
                onClick={confirmDeleteAccount}
                disabled={deleteConfirmText !== 'DELETE'}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Удалить аккаунт
              </button>
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setDeleteConfirmText('')
                }}
                className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-all"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
