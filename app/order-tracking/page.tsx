'use client'
import { useState, type FormEvent } from 'react'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { LangProvider, useLang } from '@/lib/i18n'
import {
  Search,
  MapPin,
  Info,
  Package,
  Truck,
  CheckCircle,
  RotateCcw,
  Ban,
  SearchX,
} from 'lucide-react'
import { getDisplayStage, STAGE_BADGE_CLASS, type DisplayStage } from '@/lib/order-status'

interface TrackResult {
  found: boolean
  order_number?: string
  status?: string
  courier_stage?: string
  client_address?: string
  created_at?: string
  queue_position?: number
}

const STAGE_ICON: Record<DisplayStage, typeof Package> = {
  not_started: Package,
  dropped: Package,
  departed: Truck,
  arrived: MapPin,
  delivered: CheckCircle,
  returned: RotateCcw,
  cancelled: Ban,
}

const TERMINAL_STAGES: DisplayStage[] = ['delivered', 'returned', 'cancelled']

function LangSwitcher() {
  const { lang, setLang } = useLang()
  return (
    <div className="flex gap-1">
      {(['ru', 'kz'] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
            lang === l
              ? 'bg-red-600 text-white shadow-sm'
              : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
          }`}
        >
          {l === 'ru' ? 'Рус' : 'Қаз'}
        </button>
      ))}
    </div>
  )
}

function OrderTrackingContent() {
  const { t } = useLang()
  const [orderNumber, setOrderNumber] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<TrackResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const STAGE_LABEL_LOCAL: Record<DisplayStage, string> = {
    not_started: t('trackStageNotStarted'),
    dropped: t('trackStageDropped'),
    departed: t('trackStageDeparted'),
    arrived: t('trackStageArrived'),
    delivered: t('trackStageDelivered'),
    returned: t('trackStageReturned'),
    cancelled: t('trackStageCancelled'),
  }

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault()
    const trimmedOrder = orderNumber.trim()
    if (!trimmedOrder) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch(
        `/api/track-order?order_number=${encodeURIComponent(trimmedOrder)}`
      )
      if (res.status === 404) {
        setResult({ found: false })
      } else {
        const data = await res.json()
        if (!res.ok) {
          setError(data.error || t('trackSearchErrorMsg'))
        } else {
          setResult(data as TrackResult)
        }
      }
    } catch {
      setError(t('trackServerErrorMsg'))
    } finally {
      setLoading(false)
    }
  }

  const stage =
    result?.found && result.status && result.courier_stage
      ? getDisplayStage({ status: result.status, courier_stage: result.courier_stage })
      : null
  const StageIcon = stage ? STAGE_ICON[stage] : null

  return (
    <div className="min-h-full flex flex-col bg-[#f8f8f8]">
      <Navbar />
      <main className="flex-1 mx-auto w-full max-w-2xl px-6 pt-36 pb-20">
        <div className="flex justify-end">
          <LangSwitcher />
        </div>
        <h1 className="mt-4 text-3xl font-black tracking-tight text-gray-900 text-center">
          {t('trackOrderTitle')}
        </h1>
        <p className="mt-2 text-center text-sm text-gray-400">
          {t('trackOrderSubtitle')}
        </p>
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm text-blue-800">
          <Info size={18} className="mt-0.5 flex-shrink-0 text-blue-500" />
          <p>{t('trackInfoText')}</p>
        </div>
        <form onSubmit={handleSearch} className="mt-6 flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            placeholder={t('trackOrderNumberPlaceholder')}
            className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition-colors focus:border-primary"
          />
          <button
            type="submit"
            disabled={loading || !orderNumber.trim()}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
          >
            <Search size={16} />
            {loading ? t('trackSearchingLabel') : t('findOrderBtn')}
          </button>
        </form>
        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            {error}
          </div>
        )}
        {result && !result.found && (
          <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-gray-100 bg-white py-14 text-center shadow-sm">
            <SearchX size={40} className="text-gray-300" />
            <p className="text-sm text-gray-500">
              {t('trackNotFoundMsg')}
            </p>
          </div>
        )}
        {result?.found && stage && StageIcon && (
          <div className="mt-8 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm font-bold text-gray-900">
                {result.order_number}
              </span>
              <div className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${STAGE_BADGE_CLASS[stage]}`}>
                <StageIcon size={12} />
                {STAGE_LABEL_LOCAL[stage]}
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
              <MapPin size={15} className="flex-shrink-0 text-gray-400" />
              <span>{result.client_address}</span>
            </div>
            {!TERMINAL_STAGES.includes(stage) && (
              <div className="mt-5 rounded-xl bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700">
                {t('trackQueuePositionMsg').replace('{position}', String(result.queue_position))}
              </div>
            )}
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}

export default function OrderTrackingPage() {
  return (
    <LangProvider>
      <OrderTrackingContent />
    </LangProvider>
  )
}
