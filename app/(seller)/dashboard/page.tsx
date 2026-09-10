'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import * as XLSX from 'xlsx'
import {
  Package, Truck, CheckCircle, MapPin, RotateCcw, Ban, Search, Calendar,
  Download, Share2, Shuffle, RefreshCw, X,
} from 'lucide-react'
import { useLang, localeTag } from '@/lib/i18n'
import { waTemplates, openWhatsApp, defaultDeliveryWindow } from '@/lib/whatsapp-templates'
import { getSellerCourierIds } from '@/lib/couriers'
import { getDisplayStage, STAGE_LABEL, STAGE_BADGE_CLASS, type DisplayStage } from '@/lib/order-status'
import { Toast } from '@/components/Toast'
import { generatePDF } from '@/lib/invoice-pdf'
import { dayStartMs, dayEndMs, todayInAlmaty } from '@/lib/date-range'

const MapGL = dynamic(() => import('@/components/MapGL'), { ssr: false })

const PAGE_SIZE = 15
// Кап на один клик "Распределить" — раньше запрос без .range() молча
// обрезался PostgREST на 1000 строк (без ошибки и без предупреждения), а
// WhatsApp-уведомления и reload после распределения считались от этого
// необрезанного списка. На backlog в тысячи заказов это грозило открыть
// сотни-тысячи WhatsApp-вкладок и подвесить вкладку до перезагрузки на
// много минут. Явный маленький кап + видимый остаток — временное решение;
// zone-aware распределение (обход круга по зоне заказа, не по всем
// курьерам продавца подряд) — отдельная задача следующим шагом.
const DISTRIBUTE_BATCH_SIZE = 300
const ORDER_COLUMNS =
  'id, order_number, client_phone, client_address, status, courier_stage, price, courier_name, comment, lat, lng, photo_url, created_at, dropped_at, accepted_at, product_name, planned_delivery_date'

// Заказы, у которых дата поступления (created_at) ИЛИ плановая дата доставки
// Kaspi (planned_delivery_date) попадает в выбранный диапазон — объединение,
// не пересечение: то, что пришло раньше, но везти именно в этот день, не
// должно теряться. Без явного диапазона дат (дефолт вкладки "Активные") —
// диапазон "сегодня" в Алматы. Раньше явный выбор дат в фильтре сравнивался
// только с created_at — заказы, давно созданные, но с плановой доставкой
// внутри выбранного диапазона, из-за этого пропадали из списка (0 совпадений
// при явном диапазоне дат доставки, хотя счётчики в Kaspi показывали сотни).
function applyOrdersDateFilter<T extends { gte: any; lte: any; or: any }>(query: T, from: string, to: string): T {
  const useToday = !from && !to
  const rangeFrom = useToday ? todayInAlmaty() : from
  const rangeTo = useToday ? todayInAlmaty() : to
  const startIso = rangeFrom ? new Date(dayStartMs(rangeFrom)).toISOString() : null
  const endIso = rangeTo ? new Date(dayEndMs(rangeTo)).toISOString() : null
  const clause = (column: string) => {
    const parts: string[] = []
    if (startIso) parts.push(`${column}.gte.${startIso}`)
    if (endIso) parts.push(`${column}.lte.${endIso}`)
    return parts.length > 1 ? `and(${parts.join(',')})` : parts[0]
  }
  return query.or(`${clause('created_at')},${clause('planned_delivery_date')}`)
}

type OrderStatus = 'pending' | 'in_transit' | 'delivered'
type Tab = 'active' | 'cancelled' | 'archive'
type ToastState = { message: string; type: 'error' | 'success'; actionLabel?: string; actionHref?: string } | null

interface Order {
  id: string
  order_number: string
  client_phone: string
  client_address: string
  status: OrderStatus
  courier_stage: string | null
  price: number
  courier_name: string | null
  comment: string | null
  lat: number | null
  lng: number | null
  photo_url: string | null
  created_at: string
  dropped_at: string | null
  accepted_at: string | null
  product_name: string | null
  planned_delivery_date: string | null
}

interface ExportRow {
  orderNum: string
  phone: string
  address: string
  price: number | string
  status: string
  date: string
}

function exportRowsToExcel(
  rows: ExportRow[],
  t: ReturnType<typeof useLang>['t'],
  sheetName: string,
  fileName: string
) {
  const data = rows.map((r) => ({
    [t('orderNum')]: r.orderNum,
    [t('phone')]: r.phone,
    [t('address')]: r.address,
    [t('price')]: r.price,
    [t('status')]: r.status,
    [t('date')]: r.date,
  }))
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, fileName)
}

const STAGE_ICON: Record<DisplayStage, React.ReactNode> = {
  not_started: <Package size={13} />,
  dropped: <Package size={13} />,
  departed: <Truck size={13} />,
  arrived: <MapPin size={13} />,
  delivered: <CheckCircle size={13} />,
  returned: <RotateCcw size={13} />,
  cancelled: <Ban size={13} />,
}

// Загружает полный (без пагинации) набор заказов с данными, нужными для PDF-накладной
// (zones/product_name) — отдельно от таблицы orders (та пагинирована и без этих полей).
async function fetchInvoiceOrders(sellerId: string, ids?: string[]) {
  let query = supabase
    .from('orders')
    .select('id, order_number, client_phone, client_address, status, price, created_at, product_name, product_quantity, zone_id, zones ( name, display_number )')
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false })
  if (ids && ids.length > 0) query = query.in('id', ids)
  const { data, error } = await query
  if (error) throw error
  return data || []
}

async function fetchSellerInfo(sellerId: string) {
  const { data } = await supabase
    .from('sellers')
    .select('organization_name, phone')
    .eq('id', sellerId)
    .maybeSingle()
  return data
}

export default function SellerOrdersPage() {
  const { t } = useLang()
  const [tab, setTab] = useState<Tab>('active')
  const [sellerId, setSellerId] = useState<string | null>(null)
  const [headerCounts, setHeaderCounts] = useState({ shipped: 0, delivered: 0 })
  const [downloadingInvoices, setDownloadingInvoices] = useState(false)
  const [toast, setToast] = useState<ToastState>(null)
  const exportRowsRef = useRef<() => ExportRow[]>(() => [])

  function exportCurrentTabToExcel() {
    exportRowsToExcel(exportRowsRef.current(), t, t('ordersNav'), 'zakazy.xlsx')
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (cancelled || !user) return
      setSellerId(user.id)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!sellerId) return
    let cancelled = false
    async function loadCounts() {
      const [{ count: shippedCount }, { count: deliveredCount }] = await Promise.all([
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('seller_id', sellerId!).in('status', ['in_transit', 'delivered']),
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('seller_id', sellerId!).eq('status', 'delivered'),
      ])
      if (!cancelled) setHeaderCounts({ shipped: shippedCount ?? 0, delivered: deliveredCount ?? 0 })
    }
    loadCounts()
    const channel = supabase
      .channel('orders-header-counts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `seller_id=eq.${sellerId}` }, loadCounts)
      .subscribe()
    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [sellerId])

  async function downloadAllInvoices() {
    if (!sellerId || downloadingInvoices) return
    setDownloadingInvoices(true)
    try {
      const [orders, seller] = await Promise.all([fetchInvoiceOrders(sellerId), fetchSellerInfo(sellerId)])
      for (const order of orders as any[]) {
        await generatePDF(order, seller as any)
      }
    } catch (err) {
      console.error(err)
      setToast({ message: t('invoiceGenerateErrorMsg'), type: 'error' })
    } finally {
      setDownloadingInvoices(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-4 md:px-8 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">{t('ordersNav')}</h1>
            <p className="text-sm text-gray-400 mt-0.5">{t('dashboardSub')}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-3 text-sm font-semibold text-gray-600 bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5">
              <span>{t('shippedCountLabel')} <span className="text-gray-900 font-black">{headerCounts.shipped}</span></span>
              <span className="w-px h-4 bg-gray-200" />
              <span>{t('deliveredCountLabel')} <span className="text-gray-900 font-black">{headerCounts.delivered}</span></span>
            </div>
            <button
              onClick={downloadAllInvoices}
              disabled={downloadingInvoices || !sellerId}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-red-100"
            >
              <Download size={16} />
              {downloadingInvoices ? t('loading') : t('downloadInvoices')}
            </button>
            <button
              onClick={exportCurrentTabToExcel}
              disabled={!sellerId}
              className="flex items-center gap-2 bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm"
            >
              <Download size={16} />
              {t('exportExcelBtn')}
            </button>
          </div>
        </div>
        <div className="flex rounded-xl border border-gray-200 overflow-hidden w-fit">
          {(['active', 'cancelled', 'archive'] as Tab[]).map((key) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 text-sm font-bold transition-all ${
                tab === key ? 'bg-red-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              {key === 'active' ? t('ordersActiveTab') : key === 'cancelled' ? t('cancelled') : t('ordersArchiveTab')}
            </button>
          ))}
        </div>
      </header>

      {tab === 'active' && <ActiveOrdersTab sellerId={sellerId} onToast={setToast} exportRowsRef={exportRowsRef} />}
      {tab === 'cancelled' && <CancelledOrdersTab sellerId={sellerId} onToast={setToast} exportRowsRef={exportRowsRef} />}
      {tab === 'archive' && <ArchiveTab sellerId={sellerId} onToast={setToast} exportRowsRef={exportRowsRef} />}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          actionLabel={toast.actionLabel}
          actionHref={toast.actionHref}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}

// ============================== Активные заказы ==============================

function ActiveOrdersTab({
  sellerId,
  onToast,
  exportRowsRef,
}: {
  sellerId: string | null
  onToast: (t: ToastState) => void
  exportRowsRef: React.RefObject<() => ExportRow[]>
}) {
  const { t, lang } = useLang()
  const locale = localeTag(lang)
  const STAGE_LABEL_LOCAL: Record<DisplayStage, string> = {
    not_started: t('stageNotStarted'),
    dropped: t('stageDropped'),
    departed: t('stageDeparted'),
    arrived: t('stageArrived'),
    delivered: t('stageDelivered'),
    returned: t('stageReturned'),
    cancelled: t('stageCancelled'),
  }
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<OrderStatus | 'all'>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [distributing, setDistributing] = useState(false)
  const [photoOrder, setPhotoOrder] = useState<Order | null>(null)
  const [uploading, setUploading] = useState(false)
  const [returnOrder, setReturnOrder] = useState<Order | null>(null)
  const [returnReason, setReturnReason] = useState('')
  const [submittingReturn, setSubmittingReturn] = useState(false)
  const [massUpdating, setMassUpdating] = useState(false)
  const [syncingKaspi, setSyncingKaspi] = useState(false)
  const [downloadingSelected, setDownloadingSelected] = useState(false)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [statCounts, setStatCounts] = useState<Record<OrderStatus, number>>({
    pending: 0,
    in_transit: 0,
    delivered: 0,
  })

  useEffect(() => {
    if (!photoOrder) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPhotoOrder(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [photoOrder])

  async function fetchOrdersPage(
    currentSellerId: string,
    pageIndex: number,
    replace: boolean,
    from: string,
    to: string,
    status: OrderStatus | 'all'
  ) {
    const rangeFrom = pageIndex * PAGE_SIZE
    const rangeTo = rangeFrom + PAGE_SIZE - 1
    let query = supabase
      .from('orders')
      .select(ORDER_COLUMNS)
      .eq('seller_id', currentSellerId)
      .neq('courier_stage', 'cancelled')
      .order('created_at', { ascending: false })
    query = applyOrdersDateFilter(query, from, to)
    // Раньше статус фильтровался только клиентски, над уже загруженной страницей —
    // если среди самых свежих PAGE_SIZE строк не было ни одной нужного статуса
    // (а их могут быть сотни где-то дальше по пагинации), список показывал 0,
    // хотя счётчик (fetchStatCounts, серверный) честно считал сотни совпадений.
    // Отменённые заказы (courier_stage='cancelled') всегда исключены выше —
    // они живут на отдельной вкладке "Отменённые" независимо от status.
    // Доставленные исключаем только во вью "все" — карточка "Доставлено"
    // должна по-прежнему показывать их по клику.
    if (status !== 'all') query = query.eq('status', status)
    else query = query.neq('status', 'delivered')
    const { data, error } = await query.range(rangeFrom, rangeTo)
    if (error) {
      console.error(error.message)
      onToast({ message: t('loadErrorPrefix') + error.message, type: 'error' })
      return
    }
    const rows = (data || []) as Order[]
    setOrders((prev) => (replace ? rows : [...prev, ...rows]))
    setHasMore(rows.length === PAGE_SIZE)
    setPage(pageIndex + 1)
  }

  async function fetchStatCounts(currentSellerId: string, from: string, to: string) {
    const statuses: OrderStatus[] = ['pending', 'in_transit', 'delivered']
    const results = await Promise.all(
      statuses.map((status) => {
        let query = supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('seller_id', currentSellerId)
          .eq('status', status)
          .neq('courier_stage', 'cancelled')
        query = applyOrdersDateFilter(query, from, to)
        return query
      })
    )
    setStatCounts({
      pending: results[0].count ?? 0,
      in_transit: results[1].count ?? 0,
      delivered: results[2].count ?? 0,
    })
  }

  async function refreshOrders() {
    if (!sellerId) return
    setLoading(true)
    await Promise.all([
      fetchOrdersPage(sellerId, 0, true, dateFrom, dateTo, filterStatus),
      fetchStatCounts(sellerId, dateFrom, dateTo),
    ])
    setLoading(false)
  }

  async function loadMoreOrders() {
    if (!sellerId || loadingMore || !hasMore) return
    setLoadingMore(true)
    await fetchOrdersPage(sellerId, page, false, dateFrom, dateTo, filterStatus)
    setLoadingMore(false)
  }

  const filtersRef = useRef({ dateFrom: '', dateTo: '', filterStatus: 'all' as OrderStatus | 'all' })
  useEffect(() => {
    filtersRef.current = { dateFrom, dateTo, filterStatus }
  }, [dateFrom, dateTo, filterStatus])

  // Только подписка на realtime — заведена отдельно от загрузки данных
  // (ниже) и держится на [sellerId], а не на фильтрах: иначе на каждое
  // изменение даты/статуса пришлось бы пересоздавать канал. Актуальные
  // фильтры для колбэка берутся из filtersRef, а не из замыкания.
  useEffect(() => {
    if (!sellerId) return
    const channel = supabase
      .channel('orders-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `seller_id=eq.${sellerId}` },
        () => {
          fetchOrdersPage(
            sellerId,
            0,
            true,
            filtersRef.current.dateFrom,
            filtersRef.current.dateTo,
            filtersRef.current.filterStatus
          )
          fetchStatCounts(sellerId, filtersRef.current.dateFrom, filtersRef.current.dateTo)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sellerId])

  // Загрузка списка и счётчиков — один эффект и на первое открытие страницы
  // (sellerId появился), и на смену дат/статуса-карточки. Раньше это были
  // два отдельных эффекта, оба с sellerId в зависимостях — при появлении
  // sellerId срабатывали оба разом, и список с счётчиками грузились дважды.
  useEffect(() => {
    if (!sellerId) return
    let cancelled = false
    setLoading(true)
    Promise.all([
      fetchOrdersPage(sellerId, 0, true, dateFrom, dateTo, filterStatus),
      fetchStatCounts(sellerId, dateFrom, dateTo),
    ]).then(() => {
      if (!cancelled) setLoading(false)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sellerId, dateFrom, dateTo, filterStatus])

  const filtered = orders.filter((o) => {
    const matchStatus = filterStatus === 'all' || o.status === filterStatus
    // Как и серверный запрос (applyOrdersDateFilter) — совпадение по дате
    // создания ИЛИ по плановой дате доставки Kaspi, не пересечение.
    const createdTime = new Date(o.created_at).getTime()
    const inCreatedRange = (!dateFrom || createdTime >= dayStartMs(dateFrom)) && (!dateTo || createdTime <= dayEndMs(dateTo))
    const plannedTime = o.planned_delivery_date ? new Date(o.planned_delivery_date).getTime() : null
    const inPlannedRange =
      plannedTime != null && (!dateFrom || plannedTime >= dayStartMs(dateFrom)) && (!dateTo || plannedTime <= dayEndMs(dateTo))
    const matchDate = (!dateFrom && !dateTo) || inCreatedRange || inPlannedRange
    const matchSearch =
      o.order_number.toLowerCase().includes(search.toLowerCase()) ||
      o.client_phone.includes(search) ||
      o.client_address.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchDate && matchSearch
  })

  useEffect(() => {
    exportRowsRef.current = () =>
      filtered.map((o) => ({
        orderNum: o.order_number,
        phone: o.client_phone,
        address: o.client_address,
        price: o.price,
        status: STAGE_LABEL_LOCAL[getDisplayStage(o)],
        date: o.created_at,
      }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered])

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map((o) => o.id)))
  }

  const massSetStatus = async (status: OrderStatus) => {
    if (selected.size === 0 || !sellerId || massUpdating) return
    setMassUpdating(true)
    const targetIds = Array.from(selected)
    const changedOrders = orders.filter((o) => targetIds.includes(o.id) && o.status !== status)

    const { error } = await supabase.from('orders').update({ status }).in('id', targetIds).eq('seller_id', sellerId)
    if (error) {
      console.error(error)
      onToast({ message: t('saveErrorGeneric'), type: 'error' })
      setSelected(new Set())
      setMassUpdating(false)
      return
    }
    onToast({ message: t('statusUpdatedMsg'), type: 'success' })
    setSelected(new Set())
    setMassUpdating(false)

    if ((status === 'in_transit' || status === 'delivered') && changedOrders.length > 0) {
      changedOrders.forEach((order, i) => {
        setTimeout(() => {
          const text =
            status === 'in_transit'
              ? waTemplates.order_in_transit({ number: order.order_number })
              : waTemplates.order_delivered({ number: order.order_number })
          openWhatsApp(order.client_phone, text)
        }, i * 700)
      })
      onToast({ message: t('waSentMsg'), type: 'success' })
    }
  }

  const downloadSelectedInvoices = async () => {
    if (!sellerId || downloadingSelected || selected.size === 0) return
    setDownloadingSelected(true)
    try {
      const invoiceOrders = await fetchInvoiceOrders(sellerId, Array.from(selected))
      const seller = await fetchSellerInfo(sellerId)
      for (const order of invoiceOrders as any[]) {
        await generatePDF(order, seller as any)
      }
    } catch (err) {
      console.error(err)
      onToast({ message: t('invoiceGenerateErrorMsg'), type: 'error' })
    } finally {
      setDownloadingSelected(false)
    }
  }

  const whatsappBroadcast = async () => {
    if (!sellerId) return
    const { data, error } = await supabase
      .from('orders')
      .select('id, order_number, client_phone')
      .eq('seller_id', sellerId)
      .eq('status', 'pending')
    if (error) {
      console.error(error)
      onToast({ message: t('loadErrorPrefix') + error.message, type: 'error' })
      return
    }
    const pendingOrders = data || []
    if (pendingOrders.length === 0) {
      alert(t('noOrdersForBroadcast'))
      return
    }

    pendingOrders.forEach((order, i) => {
      setTimeout(() => {
        const { deliveryFrom, deliveryTo } = defaultDeliveryWindow()
        const text = waTemplates.order_accepted({ number: order.order_number, deliveryFrom, deliveryTo })
        openWhatsApp(order.client_phone, text)
      }, i * 700)
    })
  }

  const distributeOrders = async () => {
    if (!sellerId) return
    setDistributing(true)

    // Сколько всего заказов ждёт распределения — отдельным head-запросом
    // (без .range() он не грузит строки, только count), чтобы после батча
    // показать честный остаток, а не только "распределено N".
    const { count: totalPendingCount, error: countError } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('seller_id', sellerId)
      .eq('status', 'pending')
      .is('courier_name', null)
    if (countError) {
      console.error(countError)
      onToast({ message: t('loadErrorPrefix') + countError.message, type: 'error' })
      setDistributing(false)
      return
    }
    if (!totalPendingCount) {
      alert(t('noOrdersForDistribution'))
      setDistributing(false)
      return
    }

    // Один клик обрабатывает не весь backlog, а ограниченную пачку —
    // см. DISTRIBUTE_BATCH_SIZE. Сортировка по created_at делает повторные
    // клики предсказуемыми: каждый следующий забирает следующую пачку
    // самых старых нераспределённых заказов, а не случайный/недетерминированный срез.
    const { data: pendingOrdersData, error: pendingError } = await supabase
      .from('orders')
      .select('id, order_number, client_phone')
      .eq('seller_id', sellerId)
      .eq('status', 'pending')
      .is('courier_name', null)
      .order('created_at', { ascending: true })
      .range(0, DISTRIBUTE_BATCH_SIZE - 1)
    if (pendingError) {
      console.error(pendingError)
      onToast({ message: t('loadErrorPrefix') + pendingError.message, type: 'error' })
      setDistributing(false)
      return
    }
    const pendingOrders = pendingOrdersData || []
    if (pendingOrders.length === 0) {
      alert(t('noOrdersForDistribution'))
      setDistributing(false)
      return
    }

    const courierIds = await getSellerCourierIds(sellerId)
    if (courierIds.length === 0) {
      alert(t('noActiveCouriers'))
      setDistributing(false)
      return
    }

    const { data: couriersData, error: couriersError } = await supabase
      .from('couriers')
      .select('id, full_name')
      .eq('status', 'active')
      .in('id', courierIds)
    if (couriersError) {
      console.error(couriersError)
      onToast({ message: t('loadErrorPrefix') + couriersError.message, type: 'error' })
    }

    if (!couriersData || couriersData.length === 0) {
      alert(t('noActiveCouriers'))
      setDistributing(false)
      return
    }

    let hadError = false
    const distributed: typeof pendingOrders = []
    for (let i = 0; i < pendingOrders.length; i++) {
      const courier = couriersData[i % couriersData.length]
      const { error } = await supabase
        .from('orders')
        .update({ courier_name: courier.full_name, status: 'in_transit' })
        .eq('id', pendingOrders[i].id)
        .eq('seller_id', sellerId)
      if (error) {
        console.error(error)
        hadError = true
      } else {
        distributed.push(pendingOrders[i])
      }
    }
    if (hadError) onToast({ message: t('saveErrorGeneric'), type: 'error' })

    // WhatsApp открывается только на реально распределённую пачку (максимум
    // DISTRIBUTE_BATCH_SIZE вкладок), а не на весь backlog — заказы за
    // пределами пачки в distributed не попадают вообще.
    distributed.forEach((order, i) => {
      setTimeout(() => {
        const text = waTemplates.order_in_transit({ number: order.order_number })
        openWhatsApp(order.client_phone, text)
      }, i * 700)
    })
    if (distributed.length > 0 && !hadError) {
      const remaining = Math.max(totalPendingCount - distributed.length, 0)
      onToast({
        message: t('distributedBatchResultMsg')
          .replace('{distributed}', String(distributed.length))
          .replace('{remaining}', String(remaining)),
        type: 'success',
      })
    }

    setDistributing(false)
    setTimeout(() => window.location.reload(), distributed.length * 700 + 500)
  }

  const syncFromKaspi = async () => {
    if (syncingKaspi) return
    setSyncingKaspi(true)
    try {
      const res = await fetch('/api/kaspi/sync-manual', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        onToast({ message: t('syncKaspiErrorPrefix') + (data?.error ?? t('serverErrorGeneric')), type: 'error' })
        return
      }
      const result = data?.results?.[0]
      if (!result) {
        onToast({ message: t('syncKaspiErrorPrefix') + t('serverErrorGeneric'), type: 'error' })
        return
      }
      if (result.error === 'kaspi_token не задан') {
        onToast({ message: t('syncKaspiTokenMissingMsg'), type: 'error', actionLabel: t('goToProfileBtn'), actionHref: '/profile' })
        return
      }
      if (result.error) {
        onToast({ message: t('syncKaspiErrorPrefix') + result.error, type: 'error' })
        return
      }
      onToast({ message: t('syncKaspiSuccessMsg').replace('{count}', String(result.synced)), type: 'success' })
      refreshOrders()
    } catch {
      onToast({ message: t('syncKaspiErrorPrefix') + t('serverErrorGeneric'), type: 'error' })
    } finally {
      setSyncingKaspi(false)
    }
  }

  const STAT_CARDS = [
    { key: 'pending' as OrderStatus, icon: Package, color: 'text-amber-600', border: 'border-amber-100', iconBg: 'bg-amber-50' },
    { key: 'in_transit' as OrderStatus, icon: Truck, color: 'text-blue-600', border: 'border-blue-100', iconBg: 'bg-blue-50' },
    { key: 'delivered' as OrderStatus, icon: CheckCircle, color: 'text-green-600', border: 'border-green-100', iconBg: 'bg-green-50' },
  ]

  const mapPoints = orders
    .filter((o) => o.lat && o.lng)
    .map((o) => ({
      id: o.id,
      lat: o.lat!,
      lng: o.lng!,
      order_number: o.order_number,
      client_address: o.client_address,
      client_phone: o.client_phone,
      status: o.status,
      price: o.price,
      product_name: o.product_name,
    }))

  async function uploadPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !photoOrder) return
    setUploading(true)

    const safeName =
      file.name
        .replace(/[^\x00-\x7F]/g, '')
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .toLowerCase() || 'photo.jpg'
    const path = `${photoOrder.id}/${Date.now()}_${safeName}`
    const { error } = await supabase.storage.from('order-photos').upload(path, file)

    if (error) {
      alert(t('uploadErrorPrefix') + error.message)
      setUploading(false)
      return
    }

    const { data: pub } = supabase.storage.from('order-photos').getPublicUrl(path)
    const { error: updateError } = await supabase
      .from('orders')
      .update({ photo_url: pub.publicUrl })
      .eq('id', photoOrder.id)
      .eq('seller_id', sellerId ?? '')
    if (updateError) {
      console.error(updateError)
      onToast({ message: t('saveErrorGeneric'), type: 'error' })
    } else {
      onToast({ message: t('photoUploadedMsg'), type: 'success' })
    }

    setUploading(false)
    setPhotoOrder(null)
    refreshOrders()
  }

  async function submitReturnRequest() {
    if (!returnOrder || !sellerId) return
    const reason = returnReason.trim()
    if (!reason) {
      onToast({ message: t('returnReasonRequiredMsg'), type: 'error' })
      return
    }
    setSubmittingReturn(true)
    const { error } = await supabase
      .from('return_requests')
      .insert({ order_id: returnOrder.id, seller_id: sellerId, reason })
    setSubmittingReturn(false)
    if (error) {
      console.error(error)
      onToast({ message: t('saveErrorGeneric'), type: 'error' })
      return
    }
    onToast({ message: t('returnRequestSentMsg'), type: 'success' })
    setReturnOrder(null)
    setReturnReason('')
  }

  return (
    <main className="px-4 md:px-8 py-6 max-w-7xl mx-auto">
      {/* Действия с заказами */}
      <div className="flex flex-wrap items-center justify-end gap-3 mb-6">
        <button
          onClick={syncFromKaspi}
          disabled={syncingKaspi}
          className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-400 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm"
        >
          <RefreshCw size={16} className={syncingKaspi ? 'animate-spin' : ''} />
          {syncingKaspi ? t('syncingKaspiLabel') : t('syncKaspiBtn')}
        </button>
        <button
          onClick={whatsappBroadcast}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm shadow-green-200"
        >
          <Share2 size={16} />
          {t('whatsappBroadcast')}
        </button>
        <button
          onClick={distributeOrders}
          disabled={distributing}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm shadow-blue-200"
        >
          <Shuffle size={16} />
          {distributing ? t('distributingLabel') : t('distribute')}
        </button>
      </div>

      {/* Карточки статистики */}
      <div className="grid grid-cols-3 gap-5 mb-6">
        {STAT_CARDS.map(({ key, icon: Icon, color, border, iconBg }) => (
          <div
            key={key}
            onClick={() => setFilterStatus(filterStatus === key ? 'all' : key)}
            className={`bg-white rounded-2xl border-2 ${border} p-6 cursor-pointer transition-all hover:shadow-md ${filterStatus === key ? 'ring-2 ring-red-400 shadow-md' : ''}`}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-gray-500">{t(key)}</span>
              <div className={`${iconBg} p-2 rounded-xl`}>
                <Icon size={20} className={color} />
              </div>
            </div>
            <p className={`text-5xl font-black ${color}`}>{statCounts[key]}</p>
          </div>
        ))}
      </div>

      {/* Панель массовых действий */}
      {selected.size > 0 && (
        <div className="bg-red-600 text-white rounded-2xl p-4 mb-4 flex items-center justify-between shadow-lg shadow-red-200">
          <span className="text-sm font-bold">{t('massActions')}: {selected.size}</span>
          <div className="flex gap-2">
            <button
              onClick={() => massSetStatus('in_transit')}
              disabled={massUpdating}
              className="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
            >
              → {t('in_transit')}
            </button>
            <button
              onClick={() => massSetStatus('delivered')}
              disabled={massUpdating}
              className="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
            >
              → {t('delivered')}
            </button>
            <button
              onClick={downloadSelectedInvoices}
              disabled={downloadingSelected}
              className="bg-white text-red-600 px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
            >
              {downloadingSelected ? t('loading') : t('downloadSelected')}
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            >
              {t('reset')}
            </button>
          </div>
        </div>
      )}

      {/* Фильтры */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 flex flex-wrap gap-3 shadow-sm">
        <div className="flex items-center gap-2 flex-1 min-w-[200px] border border-gray-200 rounded-xl px-3 py-2 bg-gray-50">
          <Search size={16} className="text-gray-400" />
          <input
            type="text"
            placeholder={t('search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-sm w-full focus:outline-none text-gray-700 placeholder-gray-400"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as OrderStatus | 'all')}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-400"
        >
          <option value="all">{t('allStatuses')}</option>
          <option value="pending">{t('pending')}</option>
          <option value="in_transit">{t('in_transit')}</option>
          <option value="delivered">{t('delivered')}</option>
        </select>
        <label className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 text-xs text-gray-500">
          <Calendar size={16} className="text-gray-400" />
          <span className="whitespace-nowrap">{t('dateFromLabel')}</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="bg-transparent text-sm text-gray-700 focus:outline-none"
          />
        </label>
        <label className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 text-xs text-gray-500">
          <Calendar size={16} className="text-gray-400" />
          <span className="whitespace-nowrap">{t('dateToLabel')}</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="bg-transparent text-sm text-gray-700 focus:outline-none"
          />
        </label>
        {(filterStatus !== 'all' || dateFrom || dateTo || search) && (
          <button
            onClick={() => {
              setFilterStatus('all')
              setDateFrom('')
              setDateTo('')
              setSearch('')
            }}
            className="text-sm text-red-500 hover:text-red-700 font-semibold px-2"
          >
            {t('reset')}
          </button>
        )}
      </div>
      {!dateFrom && !dateTo && (
        <p className="text-xs text-gray-400 -mt-2 mb-4 px-1">{t('defaultTodayFilterHint')}</p>
      )}

      {/* Таблица */}
      {loading ? (
        <div className="text-center py-20 text-gray-400 text-sm">{t('loading')}</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-20 text-sm">
          <p className="text-gray-500 mb-1">{t('notFound')}</p>
          <p className="text-gray-400">{t('dashboardNoOrdersMsg')}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400 text-sm">{t('notFound')}</div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-4">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && selected.size === filtered.length}
                    onChange={toggleAll}
                    className="w-4 h-4 accent-red-600 cursor-pointer"
                  />
                </th>
                <th className="px-4 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{t('orderNum')}</th>
                <th className="px-4 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{t('productHeader')}</th>
                <th className="px-4 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{t('phone')}</th>
                <th className="px-4 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{t('address')}</th>
                <th className="px-4 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{t('price')}</th>
                <th className="px-4 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{t('courier')}</th>
                <th className="px-4 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{t('status')}</th>
                <th className="px-4 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{t('date')}</th>
                <th className="px-4 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">WA</th>
                <th className="px-4 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">📷</th>
                <th className="px-4 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{t('returns')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((order) => {
                const stage = getDisplayStage(order)
                return (
                  <tr
                    key={order.id}
                    className={`hover:bg-gray-50 transition-colors ${selected.has(order.id) ? 'bg-red-50' : ''}`}
                  >
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selected.has(order.id)}
                        onChange={() => toggleOne(order.id)}
                        className="w-4 h-4 accent-red-600 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-4 font-mono font-bold text-gray-900">{order.order_number}</td>
                    <td className="px-4 py-4 text-gray-600 max-w-[200px] whitespace-normal break-words">{order.product_name || '—'}</td>
                    <td className="px-4 py-4 text-gray-600">{order.client_phone}</td>
                    <td className="px-4 py-4 text-gray-500 max-w-[220px] whitespace-normal break-words">{order.client_address}</td>
                    <td className="px-4 py-4 font-bold text-gray-900">{(order.price || 0).toLocaleString(locale)} ₸</td>
                    <td className="px-4 py-4 text-gray-600 text-xs">{order.courier_name || '—'}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${STAGE_BADGE_CLASS[stage]}`}>
                        {STAGE_ICON[stage]}
                        {STAGE_LABEL_LOCAL[stage]}
                      </span>
                      {order.accepted_at ? (
                        <span
                          className="inline-block w-2 h-2 rounded-full bg-green-500 ml-2 align-middle"
                          title={t('boxAcceptedLabel')}
                        />
                      ) : order.dropped_at ? (
                        <span
                          className="inline-block w-2 h-2 rounded-full bg-amber-400 ml-2 align-middle"
                          title={t('boxDroppedLabel')}
                        />
                      ) : null}
                    </td>
                    <td className="px-4 py-4 text-gray-400 text-xs">{new Date(order.created_at).toLocaleDateString(locale)}</td>
                    <td className="px-4 py-4">
                      <button
                        onClick={() => {
                          const template =
                            order.status === 'delivered'
                              ? waTemplates.order_delivered({ number: order.order_number })
                              : order.status === 'in_transit'
                              ? waTemplates.order_in_transit({ number: order.order_number })
                              : waTemplates.order_accepted({ number: order.order_number, ...defaultDeliveryWindow() })
                          openWhatsApp(order.client_phone, template)
                        }}
                        className="text-green-600 font-bold text-xs hover:underline"
                        title={t('writeWhatsAppTitle')}
                      >
                        WA
                      </button>
                    </td>
                    <td className="px-4 py-4">
                      <button
                        onClick={() => setPhotoOrder(order)}
                        className={`text-lg ${order.photo_url ? '' : 'opacity-40'}`}
                        title={order.photo_url ? t('viewPhoto') : t('uploadPhotoBtn')}
                      >
                        📷
                      </button>
                    </td>
                    <td className="px-4 py-4">
                      <button
                        onClick={() => {
                          setReturnOrder(order)
                          setReturnReason('')
                        }}
                        className="text-gray-400 hover:text-red-600 transition-colors"
                        title={t('requestReturnBtn')}
                      >
                        <RotateCcw size={16} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
        <p className="text-xs text-gray-400 font-medium">
          {t('shown')} {filtered.length} {t('of')}{' '}
          {filterStatus === 'all'
            ? statCounts.pending + statCounts.in_transit
            : statCounts[filterStatus]}{' '}
          {t('orders')}
        </p>
        {hasMore && (
          <button
            onClick={loadMoreOrders}
            disabled={loadingMore}
            className="text-xs font-semibold text-red-600 hover:text-red-700 hover:underline disabled:opacity-50"
          >
            {loadingMore ? t('loading') : t('loadMoreBtn')}
          </button>
        )}
      </div>

      {/* Мини-карта заказов */}
      <div className="mt-6 bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-bold text-gray-700">{t('ordersMap')}</p>
          <Link href="/orders-map">
            <button className="text-xs font-semibold text-red-600 hover:text-red-700 hover:underline">
              {t('openFullMapBtn')}
            </button>
          </Link>
        </div>
        <MapGL points={mapPoints} height="300px" />
      </div>

      {/* Модалка фото */}
      {photoOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setPhotoOrder(null)}
        >
          <div
            className="bg-white rounded-2xl p-6 w-96 max-w-[90vw] max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold mb-3">{t('packagingPhotoTitle').replace('{number}', photoOrder.order_number)}</h3>
            {photoOrder.photo_url ? (
              <img src={photoOrder.photo_url} alt={t('packagingPhotoAlt')} className="w-full rounded-xl mb-3" />
            ) : (
              <p className="text-gray-500 mb-3">{t('photoNotUploaded')}</p>
            )}
            <label className="block px-4 py-2 rounded-xl bg-red-600 text-white text-center font-semibold cursor-pointer hover:bg-red-700">
              {uploading ? t('uploadingLabel') : photoOrder.photo_url ? t('replacePhoto') : t('uploadPhotoBtn')}
              <input
                type="file"
                accept="image/*"
                onChange={uploadPhoto}
                className="hidden"
                disabled={uploading}
              />
            </label>
          </div>
        </div>
      )}

      {/* Модалка заявки на возврат */}
      {returnOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setReturnOrder(null)}
        >
          <div
            className="bg-white rounded-2xl p-6 w-96 max-w-[90vw] max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold mb-3">{t('requestReturnModalTitle')} — {returnOrder.order_number}</h3>
            <p className="text-xs text-gray-400 mb-1">{t('returnReasonLabel')}</p>
            <textarea
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              placeholder={t('returnReasonPlaceholder')}
              rows={4}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-red-400"
            />
            <div className="flex gap-2">
              <button
                onClick={submitReturnRequest}
                disabled={submittingReturn}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-all"
              >
                {submittingReturn ? t('saving') : t('requestReturnBtn')}
              </button>
              <button
                onClick={() => setReturnOrder(null)}
                disabled={submittingReturn}
                className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-all"
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

// ============================== Отменённые заказы ==============================

interface CancelledOrder {
  id: string
  order_number: string
  client_phone: string
  client_address: string
  price: number
  cancel_reason: string | null
  cancelled_by: 'courier' | 'seller' | null
  cancelled_at: string | null
}

function CancelledOrdersTab({
  sellerId,
  onToast,
  exportRowsRef,
}: {
  sellerId: string | null
  onToast: (t: ToastState) => void
  exportRowsRef: React.RefObject<() => ExportRow[]>
}) {
  const { t } = useLang()
  const [orders, setOrders] = useState<CancelledOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const CANCELLED_BY_LABEL: Record<string, string> = {
    courier: t('cancelledByCourier'),
    seller: t('cancelledBySeller'),
  }

  useEffect(() => {
    if (!sellerId) return

    const fetchOrders = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, client_phone, client_address, price, cancel_reason, cancelled_by, cancelled_at')
        .eq('seller_id', sellerId)
        .eq('courier_stage', 'cancelled')
        .order('cancelled_at', { ascending: false })
      if (error) {
        console.error(error.message)
        onToast({ message: t('loadErrorPrefix') + error.message, type: 'error' })
      } else setOrders(data as CancelledOrder[])
      setLoading(false)
    }

    fetchOrders()
    const channel = supabase
      .channel('seller-cancelled-orders-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `seller_id=eq.${sellerId}` },
        fetchOrders
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sellerId])

  const filtered = orders.filter((o) => {
    const cancelledTime = o.cancelled_at ? new Date(o.cancelled_at).getTime() : null
    const matchDateFrom = !dateFrom || (cancelledTime != null && cancelledTime >= dayStartMs(dateFrom))
    const matchDateTo = !dateTo || (cancelledTime != null && cancelledTime <= dayEndMs(dateTo))
    const matchSearch =
      o.order_number.toLowerCase().includes(search.toLowerCase()) ||
      o.client_address.toLowerCase().includes(search.toLowerCase())
    return matchDateFrom && matchDateTo && matchSearch
  })

  useEffect(() => {
    exportRowsRef.current = () =>
      filtered.map((o) => ({
        orderNum: o.order_number,
        phone: o.client_phone,
        address: o.client_address,
        price: o.price,
        status: t('stageCancelled'),
        date: o.cancelled_at ?? '',
      }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered])

  return (
    <main className="px-4 md:px-8 py-6 max-w-7xl mx-auto">
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 flex flex-wrap gap-3 shadow-sm">
        <div className="flex items-center gap-2 flex-1 min-w-[200px] border border-gray-200 rounded-xl px-3 py-2 bg-gray-50">
          <Search size={16} className="text-gray-400" />
          <input
            type="text"
            placeholder={t('search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-sm w-full focus:outline-none text-gray-700 placeholder-gray-400"
          />
        </div>
        <label className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 text-xs text-gray-500">
          <Calendar size={16} className="text-gray-400" />
          <span className="whitespace-nowrap">{t('dateFromLabel')}</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="bg-transparent text-sm text-gray-700 focus:outline-none"
          />
        </label>
        <label className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 text-xs text-gray-500">
          <Calendar size={16} className="text-gray-400" />
          <span className="whitespace-nowrap">{t('dateToLabel')}</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="bg-transparent text-sm text-gray-700 focus:outline-none"
          />
        </label>
        {(dateFrom || dateTo || search) && (
          <button
            onClick={() => {
              setDateFrom('')
              setDateTo('')
              setSearch('')
            }}
            className="text-sm text-red-500 hover:text-red-700 font-semibold px-2"
          >
            {t('reset')}
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400 text-sm">{t('loading')}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Ban size={40} className="text-gray-200 mx-auto mb-4" />
          <p className="text-gray-400 text-sm">{t('notFound')}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{t('orderNum')}</th>
                  <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{t('address')}</th>
                  <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{t('cancelReasonHeader')}</th>
                  <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{t('cancelledByHeader')}</th>
                  <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{t('cancelledAtHeader')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4 font-mono font-bold text-gray-900">{order.order_number}</td>
                    <td className="px-5 py-4 text-gray-500 max-w-[220px] whitespace-normal break-words">{order.client_address}</td>
                    <td className="px-5 py-4 text-gray-600 max-w-[240px] truncate">{order.cancel_reason || '—'}</td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border border-red-200 bg-red-50 text-red-700">
                        {(order.cancelled_by && CANCELLED_BY_LABEL[order.cancelled_by]) || '—'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-400 text-xs">
                      {order.cancelled_at ? new Date(order.cancelled_at).toLocaleString('ru-RU') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <p className="text-xs text-gray-400 mt-3 font-medium">{t('total')}: {filtered.length}</p>
    </main>
  )
}

// ============================== Архив ==============================

interface ArchOrder {
  id: string
  order_number: string
  comment: string | null
  client_phone: string
  client_address: string
  price: number
  status: string
  photo_url: string | null
  created_at: string
}

type ArchiveSubTab = 'delivered' | 'old'

function isShipped(order: ArchOrder) {
  return order.status === 'in_transit' || order.status === 'delivered'
}

function ArchiveTab({
  sellerId,
  onToast,
  exportRowsRef,
}: {
  sellerId: string | null
  onToast: (t: ToastState) => void
  exportRowsRef: React.RefObject<() => ExportRow[]>
}) {
  const { t } = useLang()
  const [subTab, setSubTab] = useState<ArchiveSubTab>('delivered')
  const [orders, setOrders] = useState<ArchOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'shipped' | 'not_shipped'>('all')
  const [photoOrder, setPhotoOrder] = useState<ArchOrder | null>(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (!sellerId) return
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subTab, sellerId])

  useEffect(() => {
    if (!photoOrder) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPhotoOrder(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [photoOrder])

  async function load() {
    if (!sellerId) return
    setLoading(true)
    const status = subTab === 'delivered' ? 'delivered' : 'archived'
    const { data, error } = await supabase
      .from('orders')
      .select('id, order_number, comment, client_phone, client_address, price, status, photo_url, created_at')
      .eq('seller_id', sellerId)
      .eq('status', status)
      .order('created_at', { ascending: false })
    if (error) {
      console.error('archive load failed:', error)
      onToast({ message: t('loadErrorPrefix') + error.message, type: 'error' })
    }
    setOrders((data || []) as ArchOrder[])
    setLoading(false)
  }

  const filtered = useMemo(() => {
    let list = orders

    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (o) =>
          o.order_number.toLowerCase().includes(q) ||
          o.client_phone.toLowerCase().includes(q) ||
          o.client_address.toLowerCase().includes(q)
      )
    }

    if (dateFrom) {
      const from = dayStartMs(dateFrom)
      list = list.filter((o) => new Date(o.created_at).getTime() >= from)
    }
    if (dateTo) {
      const to = dayEndMs(dateTo)
      list = list.filter((o) => new Date(o.created_at).getTime() <= to)
    }

    if (statusFilter === 'shipped') list = list.filter((o) => isShipped(o))
    if (statusFilter === 'not_shipped') list = list.filter((o) => !isShipped(o))

    return list
  }, [orders, search, dateFrom, dateTo, statusFilter])

  const shippedCount = filtered.filter((o) => isShipped(o)).length
  const deliveredCount = filtered.filter((o) => o.status === 'delivered').length

  useEffect(() => {
    exportRowsRef.current = () =>
      filtered.map((o) => ({
        orderNum: o.order_number,
        phone: o.client_phone,
        address: o.client_address,
        price: o.price,
        status: o.status === 'delivered' ? t('issuedLabel') : t('archive'),
        date: o.created_at,
      }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered])

  function exportExcel() {
    const rows = filtered.map((o) => ({
      [t('numberCol')]: o.order_number,
      [t('shipmentHeader')]: isShipped(o) ? t('shippedLabel') : t('notShippedLabel'),
      [t('comment')]: o.comment || t('notSpecified'),
      [t('clientPhoneHeader')]: o.client_phone,
      [t('clientAddressHeader')]: o.client_address,
      [t('orderStatusHeader')]: o.status === 'delivered' ? t('issuedLabel') : t('archive'),
      [t('dateCol')]: o.created_at,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, t('archive'))
    XLSX.writeFile(wb, 'arhiv_zakazov.xlsx')
  }

  async function uploadPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !photoOrder) return
    setUploading(true)
    const safeName =
      file.name
        .replace(/[^\x00-\x7F]/g, '')
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .toLowerCase() || 'photo.jpg'
    const path = `${photoOrder.id}/${Date.now()}_${safeName}`
    const { error } = await supabase.storage.from('order-photos').upload(path, file)
    if (error) {
      alert(t('uploadErrorPrefix') + error.message)
      setUploading(false)
      return
    }
    const { data: pub } = supabase.storage.from('order-photos').getPublicUrl(path)
    const { error: updateError } = await supabase
      .from('orders')
      .update({ photo_url: pub.publicUrl })
      .eq('id', photoOrder.id)
      .eq('seller_id', sellerId ?? '')
    if (updateError) {
      console.error(updateError)
      onToast({ message: t('saveErrorGeneric'), type: 'error' })
    } else {
      onToast({ message: t('photoUploadedMsg'), type: 'success' })
    }
    setUploading(false)
    setPhotoOrder(null)
    load()
  }

  return (
    <main className="px-4 md:px-8 py-6 max-w-7xl mx-auto">
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setSubTab('delivered')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold ${
            subTab === 'delivered' ? 'bg-red-600 text-white' : 'bg-white border border-gray-200'
          }`}
        >
          {t('deliveredTab')}
        </button>
        <button
          onClick={() => setSubTab('old')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold ${
            subTab === 'old' ? 'bg-red-600 text-white' : 'bg-white border border-gray-200'
          }`}
        >
          {t('oldArchiveTab')}
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3 mb-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchDots')}
          className="border-b px-2 py-1 focus:outline-none focus:border-red-500 w-56"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="border rounded px-3 py-2 text-sm"
        >
          <option value="all">{t('shipmentAll')}</option>
          <option value="shipped">{t('shippedLabel')}</option>
          <option value="not_shipped">{t('notShippedLabel')}</option>
        </select>
        <label className="text-sm">
          <span className="block text-xs text-gray-500">{t('dateFromLabel')}</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="border rounded px-2 py-1.5"
          />
        </label>
        <label className="text-sm">
          <span className="block text-xs text-gray-500">{t('dateToLabel')}</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="border rounded px-2 py-1.5"
          />
        </label>
        <button
          onClick={exportExcel}
          className="px-4 py-2 rounded bg-green-700 text-white text-sm font-bold uppercase ml-auto"
        >
          {t('exportExcelBtn')}
        </button>
      </div>

      <div className="flex gap-4 mb-3 text-sm">
        <span className="text-red-700 font-semibold">{t('shippedCountLabel')} {shippedCount}</span>
        <span className="text-red-700 font-semibold">{t('deliveredCountLabel')} {deliveredCount}</span>
      </div>

      <div className="bg-white rounded-xl border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b bg-gray-50">
              <th className="p-3">#</th>
              <th className="p-3">{t('shipmentHeader')}</th>
              <th className="p-3">{t('comment')}</th>
              <th className="p-3">{t('clientPhoneHeader')}</th>
              <th className="p-3">{t('clientAddressHeader')}</th>
              <th className="p-3">{t('orderStatusHeader')}</th>
              <th className="p-3">📷</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-gray-500">
                  {t('loading')}
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-gray-500">
                  <p>{t('noOrders')}</p>
                  <p className="text-xs text-gray-400 mt-1">{t('archiveEmptyMsg')}</p>
                </td>
              </tr>
            )}
            {filtered.map((o) => (
              <tr key={o.id} className="border-b hover:bg-gray-50">
                <td className="p-3 text-red-600 font-semibold">{o.order_number}</td>
                <td className="p-3">{isShipped(o) ? t('shippedLabel') : t('notShippedLabel')}</td>
                <td className="p-3 text-gray-400">{o.comment || t('notSpecified')}</td>
                <td className="p-3">{o.client_phone}</td>
                <td className="p-3">{o.client_address}</td>
                <td className="p-3">{o.status === 'delivered' ? t('issuedLabel') : t('archive')}</td>
                <td className="p-3">
                  <button
                    onClick={() => setPhotoOrder(o)}
                    className={`text-lg ${o.photo_url ? '' : 'opacity-40'}`}
                    title={o.photo_url ? t('viewPhoto') : t('noPhotoUpload')}
                  >
                    📷
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {photoOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setPhotoOrder(null)}
        >
          <div
            className="relative bg-white rounded-xl p-6 w-96 max-w-[90vw] max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPhotoOrder(null)}
              aria-label={t('close')}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-700"
            >
              <X size={20} />
            </button>
            <h3 className="font-bold mb-3">
              {t('packagingPhotoTitle').replace('{number}', photoOrder.order_number)}
            </h3>
            {photoOrder.photo_url ? (
              <img
                src={photoOrder.photo_url}
                alt={t('packagingPhotoAlt')}
                className="w-full rounded-lg mb-3"
              />
            ) : (
              <p className="text-gray-500 mb-3">{t('photoNotUploaded')}</p>
            )}
            <label className="block px-4 py-2 rounded bg-red-600 text-white text-center font-semibold cursor-pointer">
              {uploading ? t('uploadingLabel') : photoOrder.photo_url ? t('replacePhoto') : t('uploadPhotoBtn')}
              <input
                type="file"
                accept="image/*"
                onChange={uploadPhoto}
                className="hidden"
                disabled={uploading}
              />
            </label>
          </div>
        </div>
      )}
    </main>
  )
}
