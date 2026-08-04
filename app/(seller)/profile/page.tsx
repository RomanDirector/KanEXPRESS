'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LogOut, Crown, Pencil, ArrowLeft, Camera, Image as ImageIcon, Trash2, Upload } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { computeSubscriptionStatus } from '@/lib/limits'
import { useLang, localeTag } from '@/lib/i18n'
import { Toast } from '@/components/Toast'

interface SellerData {
  full_name: string
  phone: string
  email: string | null
  organization_name: string
  organization_address: string
  notifications_enabled: boolean
  avatar_url: string | null
  company_logo_url: string | null
}

const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024

interface SubscriptionData {
  plan: 'free' | 'pro'
  expires_at: string | null
  cancel_at_period_end: boolean
  trial_ends_at: string | null
}

interface PaymentRow {
  id: string
  amount: number
  plan: string
  status: string
  created_at: string
}

type EditableFields = 'full_name' | 'phone' | 'organization_name' | 'organization_address'

function getInitials(fullName: string | undefined | null) {
  if (!fullName) return '?'
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  const initials = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() || '').join('')
  return initials || '?'
}

function formatDate(value: string | null, locale: string) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString(locale)
}

export default function ProfilePage() {
  const { t, lang } = useLang()
  const locale = localeTag(lang)
  const EDIT_FIELDS: { key: EditableFields; label: string }[] = [
    { key: 'full_name', label: t('fullNameLabel') },
    { key: 'phone', label: t('phone') },
    { key: 'organization_name', label: t('organizationNameLabel') },
    { key: 'organization_address', label: t('organizationAddressLabel') },
  ]
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [seller, setSeller] = useState<SellerData | null>(null)
  const [subscription, setSubscription] = useState<SubscriptionData>({
    plan: 'free',
    expires_at: null,
    cancel_at_period_end: false,
    trial_ends_at: null,
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

  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [upgrading, setUpgrading] = useState(false)
  const [paymentRequestSent, setPaymentRequestSent] = useState(false)
  const [paymentContact, setPaymentContact] = useState('')

  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarBroken, setAvatarBroken] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)

  const [kaspiShopId, setKaspiShopId] = useState('')
  const [kaspiTokenConfigured, setKaspiTokenConfigured] = useState(false)
  const [kaspiTokenInput, setKaspiTokenInput] = useState('')
  const [kaspiLoading, setKaspiLoading] = useState(true)
  const [kaspiSaving, setKaspiSaving] = useState(false)

  useEffect(() => {
    load()
    loadKaspiCredentials()
  }, [])

  async function loadKaspiCredentials() {
    setKaspiLoading(true)
    try {
      const res = await fetch('/api/seller/kaspi-credentials')
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || t('serverErrorGeneric'))
      setKaspiShopId(json.shopId || '')
      setKaspiTokenConfigured(!!json.tokenConfigured)
    } catch (err) {
      const message = err instanceof Error ? err.message : t('serverErrorGeneric')
      setToast({ message: t('kaspiCredentialsLoadErrorPrefix') + message, type: 'error' })
    }
    setKaspiLoading(false)
  }

  async function saveKaspiCredentials() {
    setKaspiSaving(true)
    try {
      const res = await fetch('/api/seller/kaspi-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopId: kaspiShopId, token: kaspiTokenInput }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || t('serverErrorGeneric'))
      if (kaspiTokenInput.trim() !== '') {
        setKaspiTokenConfigured(true)
        setKaspiTokenInput('')
      }
      setToast({ message: t('kaspiCredentialsSavedMsg'), type: 'success' })
    } catch (err) {
      const message = err instanceof Error ? err.message : t('serverErrorGeneric')
      setToast({ message: t('kaspiCredentialsSaveErrorPrefix') + message, type: 'error' })
    }
    setKaspiSaving(false)
  }

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
        .select('full_name, phone, email, organization_name, organization_address, notifications_enabled, avatar_url, company_logo_url')
        .eq('id', user.id)
        .single(),
      supabase
        .from('seller_subscriptions')
        .select('plan, expires_at, cancel_at_period_end, trial_ends_at')
        .eq('seller_id', user.id)
        .maybeSingle(),
      supabase
        .from('payment_history')
        .select('id, amount, plan, status, created_at')
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false }),
    ])

    if (sellerErr || subErr || paymentsErr) {
      if (sellerErr) console.error(sellerErr)
      if (subErr) console.error(subErr)
      if (paymentsErr) console.error(paymentsErr)
      setToast({
        message: t('loadErrorPrefix') + (sellerErr?.message || subErr?.message || paymentsErr?.message),
        type: 'error',
      })
    }

    setSeller(sellerData as SellerData)
    setSubscription({
      plan: subData?.plan === 'pro' ? 'pro' : 'free',
      expires_at: subData?.expires_at ?? null,
      cancel_at_period_end: subData?.cancel_at_period_end ?? false,
      trial_ends_at: subData?.trial_ends_at ?? null,
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
    const phone = editForm.phone.trim()
    if (phone && !/^\+7\d{10}$/.test(phone)) {
      setToast({ message: t('invalidPhoneFormatMsg'), type: 'error' })
      return
    }
    setSavingProfile(true)
    const { error } = await supabase.from('sellers').update(editForm).eq('id', userId)
    setSavingProfile(false)
    if (error) {
      console.error(error)
      alert(t('saveErrorPrefix') + error.message)
      return
    }
    setSeller((prev) => (prev ? { ...prev, ...editForm } : prev))
    setIsEditing(false)
    setToast({ message: t('profileSavedMsg'), type: 'success' })
  }

  async function uploadAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !userId) return
    setUploadingAvatar(true)

    const safeName = file.name
      .replace(/[^\x00-\x7F]/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .toLowerCase() || 'avatar.jpg'
    const path = `profile/${userId}/${Date.now()}_${safeName}`
    const { error } = await supabase.storage.from('order-photos').upload(path, file)

    if (error) {
      console.error(error)
      setToast({ message: t('uploadErrorPrefix') + error.message, type: 'error' })
      setUploadingAvatar(false)
      e.target.value = ''
      return
    }

    const { data: pub } = supabase.storage.from('order-photos').getPublicUrl(path)
    const { error: updateError } = await supabase
      .from('sellers')
      .update({ avatar_url: pub.publicUrl })
      .eq('id', userId)

    if (updateError) {
      console.error(updateError)
      setToast({ message: t('saveChangesErrorPrefix') + updateError.message, type: 'error' })
    } else {
      setAvatarBroken(false)
      setSeller((prev) => (prev ? { ...prev, avatar_url: pub.publicUrl } : prev))
      setToast({ message: t('avatarUpdatedMsg'), type: 'success' })
    }

    setUploadingAvatar(false)
    e.target.value = ''
  }

  async function uploadLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !userId) return

    if (!file.type.startsWith('image/')) {
      setToast({ message: t('imageOnlyErrorMsg'), type: 'error' })
      e.target.value = ''
      return
    }
    if (file.size > MAX_LOGO_SIZE_BYTES) {
      setToast({ message: t('fileTooLargeMsg'), type: 'error' })
      e.target.value = ''
      return
    }

    setUploadingLogo(true)

    const safeName = file.name
      .replace(/[^\x00-\x7F]/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .toLowerCase() || 'logo.jpg'
    const path = `logo/${userId}/${Date.now()}_${safeName}`
    const { error } = await supabase.storage.from('order-photos').upload(path, file)

    if (error) {
      console.error(error)
      setToast({ message: t('uploadErrorPrefix') + error.message, type: 'error' })
      setUploadingLogo(false)
      e.target.value = ''
      return
    }

    const { data: pub } = supabase.storage.from('order-photos').getPublicUrl(path)
    const { error: updateError } = await supabase
      .from('sellers')
      .update({ company_logo_url: pub.publicUrl })
      .eq('id', userId)

    if (updateError) {
      console.error(updateError)
      setToast({ message: t('saveChangesErrorPrefix') + updateError.message, type: 'error' })
    } else {
      setSeller((prev) => (prev ? { ...prev, company_logo_url: pub.publicUrl } : prev))
      setToast({ message: t('logoUploadedMsg'), type: 'success' })
    }

    setUploadingLogo(false)
    e.target.value = ''
  }

  async function deleteLogo() {
    if (!userId) return
    setUploadingLogo(true)
    const { error } = await supabase.from('sellers').update({ company_logo_url: null }).eq('id', userId)
    setUploadingLogo(false)
    if (error) {
      console.error(error)
      setToast({ message: t('logoDeleteErrorPrefix') + error.message, type: 'error' })
      return
    }
    setSeller((prev) => (prev ? { ...prev, company_logo_url: null } : prev))
    setToast({ message: t('logoDeletedMsg'), type: 'success' })
  }

  async function cancelSubscription() {
    if (!userId) return
    const dateLabel = formatDate(subscription.expires_at, locale)
    if (!confirm(t('cancelSubscriptionConfirm').replace('{date}', dateLabel))) return

    setSubscription((prev) => ({ ...prev, cancel_at_period_end: true }))
    const { error } = await supabase
      .from('seller_subscriptions')
      .update({ cancel_at_period_end: true })
      .eq('seller_id', userId)
    if (error) {
      console.error(error)
      alert(t('cancelSubErrorPrefix') + error.message)
      setSubscription((prev) => ({ ...prev, cancel_at_period_end: false }))
    } else {
      setToast({ message: t('subCancelledMsg'), type: 'success' })
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
      alert(t('resumeSubErrorPrefix') + error.message)
      setSubscription((prev) => ({ ...prev, cancel_at_period_end: true }))
    } else {
      setToast({ message: t('subResumedMsg'), type: 'success' })
    }
  }

  async function toggleNotifications() {
    if (!userId || !seller) return
    const next = !seller.notifications_enabled
    setSeller((prev) => (prev ? { ...prev, notifications_enabled: next } : prev))
    const { error } = await supabase.from('sellers').update({ notifications_enabled: next }).eq('id', userId)
    if (error) {
      console.error(error)
      setToast({ message: t('saveErrorGeneric'), type: 'error' })
      setSeller((prev) => (prev ? { ...prev, notifications_enabled: !next } : prev))
    }
  }

  async function changePassword() {
    setPasswordMsg(null)
    if (newPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: t('passwordTooShortMsg') })
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: t('passwordsMismatchMsg') })
      return
    }
    setChangingPassword(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setChangingPassword(false)
    if (error) {
      console.error(error)
      setPasswordMsg({ type: 'error', text: t('errorPrefix') + error.message })
      return
    }
    setPasswordMsg({ type: 'success', text: t('passwordChangedMsg') })
    setNewPassword('')
    setConfirmPassword('')
  }

  async function handleUpgradeConfirm() {
    if (!userId) return
    const contact = paymentContact.trim()
    if (!contact) {
      alert(t('paymentContactRequiredMsg'))
      return
    }
    setUpgrading(true)
    // Активация подписки НЕ происходит здесь — это только заявка на ручную
    // проверку перевода на Kaspi. Активирует администратор вручную через SQL
    // после того, как убедится, что деньги действительно поступили.
    let payment: PaymentRow | null = null
    try {
      const res = await fetch('/api/seller/subscription-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || t('serverErrorGeneric'))
      payment = json.payment as PaymentRow
    } catch (err) {
      const message = err instanceof Error ? err.message : t('serverErrorGeneric')
      alert(t('paymentErrorPrefix') + message)
      setUpgrading(false)
      return
    }
    setUpgrading(false)

    if (payment) setPayments((prev) => [payment as PaymentRow, ...prev])
    setShowUpgradeModal(false)
    setPaymentContact('')
    setPaymentRequestSent(true)
    setTimeout(() => setPaymentRequestSent(false), 8000)
  }

  function confirmDeleteAccount() {
    alert(t('deleteAccountComingSoonMsg'))
    setShowDeleteModal(false)
    setDeleteConfirmText('')
  }

  // Демпинг — единственная платная функция (см. /demping). Статус triala/active/expired
  // считается той же логикой, что и getSubscriptionState в lib/limits.ts.
  const subState = computeSubscriptionStatus({
    expiresAt: subscription.expires_at,
    trialEndsAt: subscription.trial_ends_at,
  })
  const SUB_STATUS_LABEL: Record<typeof subState.status, string> = {
    trial: t('subStatusTrial'),
    active: t('subStatusActive'),
    expired: t('subStatusExpired'),
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-8 py-5">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-800 mb-2"
        >
          <ArrowLeft size={16} />
          {t('back')}
        </Link>
        <div className="flex items-center gap-4">
          <div className="relative w-14 h-14 shrink-0">
            {seller?.avatar_url && !avatarBroken ? (
              <img
                src={seller.avatar_url}
                alt={seller.full_name || t('avatarAlt')}
                onError={() => setAvatarBroken(true)}
                className="w-14 h-14 rounded-full object-cover"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-red-600 text-white flex items-center justify-center text-lg font-black">
                {getInitials(seller?.full_name)}
              </div>
            )}
            <label
              className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-800 cursor-pointer shadow-sm"
              title={t('changePhotoTitle')}
            >
              <Camera size={12} />
              <input
                type="file"
                accept="image/*"
                onChange={uploadAvatar}
                className="hidden"
                disabled={uploadingAvatar}
              />
            </label>
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">{t('profileTitle')}</h1>
            <p className="text-sm text-gray-400 mt-0.5">{t('profileSubtitle')}</p>
          </div>
        </div>
      </header>

      <main className="px-8 py-6 max-w-3xl mx-auto space-y-6">
        {/* Личные данные */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-900">{t('personalDataTitle')}</h2>
            {!loading && !isEditing && (
              <button
                onClick={startEditing}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all"
                title={t('edit')}
              >
                <Pencil size={16} />
              </button>
            )}
          </div>

          {loading ? (
            <p className="text-gray-400 text-sm">{t('loading')}</p>
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
                  <p className="text-xs text-gray-400 mt-1">{t('emailCannotChangeMsg')}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={saveProfile}
                  disabled={savingProfile}
                  className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-all"
                >
                  {savingProfile ? t('saving') : t('save')}
                </button>
                <button
                  onClick={cancelEditing}
                  disabled={savingProfile}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-all"
                >
                  {t('cancel')}
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

        {/* Брендинг */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm mb-6">
          <h2 className="text-sm font-bold text-gray-900 mb-4">{t('brandingTitle')}</h2>
          <div className="flex flex-col items-center gap-4">
            <div className="w-28 h-28 shrink-0 rounded-xl border border-gray-200 overflow-hidden flex items-center justify-center bg-gray-50 shadow-inner">
              {seller?.company_logo_url ? (
                <img
                  src={seller.company_logo_url}
                  alt={t('companyLogoAlt')}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center gap-1 text-gray-300">
                  <ImageIcon size={28} />
                  <span className="text-[10px] text-gray-400 text-center px-1">{t('logoNotUploadedLabel')}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <label className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-all cursor-pointer inline-flex items-center gap-1.5">
                <Upload size={14} />
                {uploadingLogo ? t('uploadingLabel') : t('uploadLogoBtn')}
                <input
                  type="file"
                  accept="image/*"
                  onChange={uploadLogo}
                  className="hidden"
                  disabled={uploadingLogo}
                />
              </label>
              {seller?.company_logo_url && (
                <button
                  onClick={deleteLogo}
                  disabled={uploadingLogo}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50 transition-all inline-flex items-center gap-1.5"
                >
                  <Trash2 size={14} />
                  {t('deleteLogoBtn')}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Подписка */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm mb-6">
          <h2 className="text-sm font-bold text-gray-900 mb-4">{t('subscriptionTitle')}</h2>

          <div className="flex items-center gap-3 mb-2">
            <span
              className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-black uppercase tracking-wide ${
                subState.status === 'expired'
                  ? 'bg-gray-100 text-gray-500'
                  : 'bg-gradient-to-r from-amber-400 to-red-500 text-white shadow-sm shadow-amber-200'
              }`}
            >
              {subState.status !== 'expired' && <Crown size={14} />}
              {SUB_STATUS_LABEL[subState.status]}
            </span>
            {subState.status === 'trial' && (
              <span className="text-sm text-gray-400">
                {t('daysLeftLabel')
                  .replace('{days}', String(subState.daysLeft))
                  .replace('{unit}', t(subState.daysLeft === 1 ? 'dayWordOne' : 'dayWordMany'))}
              </span>
            )}
            {subState.status === 'active' && (
              <span className="text-sm text-gray-400">
                {t('activeUntilLabel').replace('{date}', formatDate(subscription.expires_at, locale))}
              </span>
            )}
          </div>

          {subscription.plan === 'pro' && subscription.cancel_at_period_end && subState.status !== 'expired' && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 mb-4 mt-3">
              {t('subCancelledUntilMsg').replace('{date}', formatDate(subscription.expires_at, locale))}
            </div>
          )}

          <div className="rounded-xl border border-gray-100 p-4 mb-5 mt-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{t('planIncludesTitle')}</p>
            <ul className="text-sm text-gray-700 space-y-1">
              <li>• {t('planFeatureDemping')}</li>
              <li>• {t('planFeatureAutoSchedule')}</li>
              <li>• {t('planFeatureKaspiPublish')}</li>
            </ul>
            <p className="text-sm font-semibold text-gray-900 mt-3">{t('pricePerMonthLabel')}</p>
          </div>

          {paymentRequestSent && (
            <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700 mb-4">
              {t('paymentRequestSentMsg')}
            </div>
          )}

          {subState.status === 'trial' && subState.daysLeft <= 3 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 mb-4">
              {t('trialEndingSoonMsg')
                .replace('{days}', String(subState.daysLeft))
                .replace('{unit}', t(subState.daysLeft === 1 ? 'dayWordOne' : 'dayWordMany'))}
            </div>
          )}

          {(subState.status === 'expired' || subState.status === 'trial') && (
            <div className="mb-4">
              <button
                onClick={() => setShowUpgradeModal(true)}
                className="px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-all"
              >
                {t('extendSubscriptionBtn')}
              </button>
            </div>
          )}

          {subState.status !== 'expired' && !subscription.cancel_at_period_end && (
            <button
              onClick={cancelSubscription}
              className="px-4 py-2.5 rounded-xl border border-red-300 text-red-600 text-sm font-semibold hover:bg-red-50 transition-all"
            >
              {t('cancelSubBtn')}
            </button>
          )}

          {subState.status !== 'expired' && subscription.cancel_at_period_end && (
            <button
              onClick={resumeSubscription}
              className="px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-all"
            >
              {t('resumeSubBtn')}
            </button>
          )}
        </div>

        {/* История платежей */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm mb-6">
          <h2 className="text-sm font-bold text-gray-900 mb-4">{t('paymentHistoryTitle')}</h2>
          {payments.length === 0 ? (
            <p className="text-gray-400 text-sm">{t('noPaymentsMsg')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-gray-100 text-gray-400 text-xs uppercase">
                    <th className="py-2 pr-4">{t('date')}</th>
                    <th className="py-2 pr-4">{t('planColHeader')}</th>
                    <th className="py-2 pr-4">{t('amountColHeader')}</th>
                    <th className="py-2 pr-4">{t('status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b border-gray-50">
                      <td className="py-2.5 pr-4 text-gray-500">{formatDate(p.created_at, locale)}</td>
                      <td className="py-2.5 pr-4 font-semibold text-gray-900 capitalize">{p.plan}</td>
                      <td className="py-2.5 pr-4 font-semibold text-gray-900">
                        {Number(p.amount).toLocaleString(locale)} ₸
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

        {/* Kaspi */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm mb-6">
          <h2 className="text-sm font-bold text-gray-900 mb-4">{t('kaspiIntegrationTitle')}</h2>
          {kaspiLoading ? (
            <p className="text-gray-400 text-sm">{t('loading')}</p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-400 mb-1">{t('kaspiShopIdLabel')}</p>
                  <input
                    value={kaspiShopId}
                    onChange={(e) => setKaspiShopId(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                  />
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">{t('kaspiTokenLabel')}</p>
                  <input
                    type="password"
                    value={kaspiTokenInput}
                    onChange={(e) => setKaspiTokenInput(e.target.value)}
                    placeholder={t('kaspiTokenPlaceholder')}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                  />
                  <p className={`text-xs mt-1 ${kaspiTokenConfigured ? 'text-green-600' : 'text-gray-400'}`}>
                    {kaspiTokenConfigured ? `✓ ${t('kaspiTokenConfiguredLabel')}` : t('kaspiTokenNotConfiguredLabel')}
                  </p>
                </div>
              </div>
              <p className="text-xs text-gray-400">{t('kaspiTokenHint')}</p>
              <button
                onClick={saveKaspiCredentials}
                disabled={kaspiSaving}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-all"
              >
                {kaspiSaving ? t('saving') : t('save')}
              </button>
            </div>
          )}
        </div>

        {/* Настройки */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm mb-6">
          <h2 className="text-sm font-bold text-gray-900 mb-4">{t('settingsTitle')}</h2>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-700">{t('notificationsToggleLabel')}</p>
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
          <h2 className="text-sm font-bold text-gray-900 mb-4">{t('securityTitle')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-xs text-gray-400 mb-1">{t('newPasswordLabel')}</p>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
              />
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">{t('confirmPasswordLabel')}</p>
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
            {changingPassword ? t('saving') : t('changePasswordBtn')}
          </button>
        </div>

        {/* Опасная зона */}
        <div className="bg-red-50 rounded-2xl border border-red-200 p-6 shadow-sm mb-6">
          <h2 className="text-sm font-bold text-red-700 mb-2">{t('dangerZoneTitle')}</h2>
          <p className="text-sm text-red-600 mb-4">{t('deleteAccountWarning')}</p>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-all"
          >
            {t('deleteAccountBtn')}
          </button>
        </div>

        {/* Выход */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 transition-all"
        >
          <LogOut size={16} />
          {t('logoutBtn')}
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
            className="bg-white rounded-2xl p-6 w-96 max-w-[90vw] max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold mb-2 text-gray-900">{t('deleteAccountBtn')}</h3>
            <p className="text-sm text-gray-600 mb-4">
              {t('deleteAccountModalText')}
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
                {t('deleteAccountBtn')}
              </button>
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setDeleteConfirmText('')
                }}
                className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-all"
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showUpgradeModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => {
            if (!upgrading) setShowUpgradeModal(false)
          }}
        >
          <div
            className="bg-white rounded-2xl p-6 w-96 max-w-[90vw] max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold mb-2 text-gray-900">{t('upgradeModalTitle')}</h3>
            <p className="text-sm text-gray-600 mb-4">
              {t('upgradeModalText')}
            </p>
            <div className="mb-4">
              <p className="text-xs text-gray-400 mb-1">{t('paymentContactLabel')}</p>
              <input
                value={paymentContact}
                onChange={(e) => setPaymentContact(e.target.value)}
                placeholder={t('paymentContactPlaceholder')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleUpgradeConfirm}
                disabled={upgrading}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-all"
              >
                {upgrading ? t('checkingLabel') : t('iPaidBtn')}
              </button>
              <button
                onClick={() => setShowUpgradeModal(false)}
                disabled={upgrading}
                className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-all"
              >
                {t('cancel')}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-3">{t('manualPaymentNoteMsg')}</p>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
