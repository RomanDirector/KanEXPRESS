'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { Html5Qrcode } from 'html5-qrcode'
import { supabase } from '@/lib/supabase'
import { Toast } from '@/components/Toast'
import { Camera, CheckCircle2, AlertTriangle, Package } from 'lucide-react'

interface OrderRow {
  id: string
  order_number: string
  client_phone: string | null
  box_id: string | null
  dropped_at: string | null
  seller_id: string
  status: string
}

interface BoxRow {
  id: string
  code: string
  label: string
}

interface BoxScanResult {
  box: BoxRow
  zoneName: string
  courierName: string
  pendingIds: string[]
  alreadyCount: number
}

interface BoxNoCourier {
  box: BoxRow
  zoneName: string | null
}

const READER_ID = 'admin-scan-qr-reader-region'

export default function AdminScanPage() {
  const [scanning, setScanning] = useState(false)
  const [manualNumber, setManualNumber] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [resultOrder, setResultOrder] = useState<OrderRow | null>(null)
  const [alreadyDropped, setAlreadyDropped] = useState(false)
  const [boxes, setBoxes] = useState<BoxRow[]>([])
  const [selectedBoxId, setSelectedBoxId] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success'; actionLabel?: string; actionHref?: string } | null>(null)

  const [boxResult, setBoxResult] = useState<BoxScanResult | null>(null)
  const [boxNoCourier, setBoxNoCourier] = useState<BoxNoCourier | null>(null)
  const [assigningBox, setAssigningBox] = useState(false)

  const scannerRef = useRef<Html5Qrcode | null>(null)

  useEffect(() => {
    return () => {
      stopScanner()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function resetResult() {
    setErrorMsg(null)
    setSuccessMsg(null)
    setResultOrder(null)
    setAlreadyDropped(false)
    setBoxes([])
    setSelectedBoxId('')
    setBoxResult(null)
    setBoxNoCourier(null)
  }

  async function stopScanner() {
    const scanner = scannerRef.current
    if (scanner) {
      try {
        await scanner.stop()
        scanner.clear()
      } catch {
        // сканер мог быть уже остановлен
      }
      scannerRef.current = null
    }
    setScanning(false)
  }

  function extractOrderNumber(raw: string): string {
    const trimmed = raw.trim()
    try {
      const url = new URL(trimmed)
      const param = url.searchParams.get('order_number') || url.searchParams.get('order')
      if (param) return param
    } catch {
      // не ссылка — значит это уже голый номер заказа (как с этикетки)
    }
    return trimmed
  }

  async function startScanner() {
    resetResult()
    setScanning(true)
    const { Html5Qrcode } = await import('html5-qrcode')
    const scanner = new Html5Qrcode(READER_ID)
    scannerRef.current = scanner
    try {
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: 250 },
        (decodedText: string) => {
          stopScanner()
          handleDecoded(extractOrderNumber(decodedText))
        },
        () => {
          // ошибка распознавания одного кадра — игнорируем
        },
      )
    } catch (e) {
      console.error(e)
      setErrorMsg('Не удалось запустить камеру')
      setScanning(false)
    }
  }

  // QR ящика (app/admin/boxes) кодирует box.code ("BOX-XXXXXX"), а не номер
  // заказа. Скан №1 (эта страница) раньше распознавал только заказы — QR
  // ящика молча уходил в "Заказ не найден", и массовое назначение курьера
  // по зоне ящика было вообще некому делать. Теперь сначала проверяем,
  // не ящик ли это, и только если нет — ищем заказ по номеру.
  async function handleDecoded(raw: string) {
    resetResult()
    if (!raw) return

    const { data: box, error: boxLookupErr } = await supabase
      .from('delivery_boxes')
      .select('id, code, label, zone_id, zones ( name )')
      .eq('code', raw)
      .maybeSingle()

    if (boxLookupErr) {
      console.error(boxLookupErr.message)
      setToast({ message: 'Ошибка загрузки ящика: ' + boxLookupErr.message, type: 'error' })
      return
    }

    if (box) {
      await lookupBox(box as unknown as BoxRow & { zone_id: string | null; zones: { name: string } | null })
      return
    }

    lookupOrder(raw)
  }

  async function lookupBox(box: BoxRow & { zone_id: string | null; zones: { name: string } | null }) {
    const zoneName = box.zones?.name || null

    if (!box.zone_id) {
      setBoxNoCourier({ box, zoneName: null })
      return
    }

    const { data: cz, error: czErr } = await supabase
      .from('courier_zones')
      .select('courier_id, couriers ( full_name )')
      .eq('zone_id', box.zone_id)
      .maybeSingle()

    if (czErr) {
      console.error(czErr.message)
      setToast({ message: 'Ошибка загрузки курьера зоны: ' + czErr.message, type: 'error' })
      return
    }

    const courierName = (cz as unknown as { couriers: { full_name: string } | null } | null)?.couriers?.full_name
    if (!cz || !courierName) {
      setBoxNoCourier({ box, zoneName })
      return
    }

    const { data: ordersInBox, error: ordersErr } = await supabase
      .from('orders')
      .select('id, courier_name, status')
      .eq('box_id', box.id)

    if (ordersErr) {
      console.error(ordersErr.message)
      setToast({ message: 'Ошибка загрузки заказов ящика: ' + ordersErr.message, type: 'error' })
      return
    }

    const rows = ordersInBox || []
    const pending = rows.filter((o) => !o.courier_name && o.status !== 'delivered' && o.status !== 'cancelled')

    setBoxResult({
      box,
      zoneName: zoneName || '—',
      courierName,
      pendingIds: pending.map((o) => o.id),
      alreadyCount: rows.length - pending.length,
    })
  }

  async function confirmBoxAssign() {
    if (!boxResult || boxResult.pendingIds.length === 0 || assigningBox) return
    setAssigningBox(true)
    const { error } = await supabase
      .from('orders')
      .update({ courier_name: boxResult.courierName, status: 'in_transit', courier_stage: 'not_started' })
      .in('id', boxResult.pendingIds)
    setAssigningBox(false)

    if (error) {
      setToast({ message: 'Ошибка: ' + error.message, type: 'error' })
      return
    }

    setSuccessMsg(
      `Ящик «${boxResult.box.label}»: курьер ${boxResult.courierName} назначен на ${boxResult.pendingIds.length} заказ(ов)`,
    )
    setBoxResult(null)
  }

  async function lookupOrder(orderNumber: string) {
    resetResult()
    if (!orderNumber) return

    const { data: order, error } = await supabase
      .from('orders')
      .select('id, order_number, client_phone, box_id, dropped_at, seller_id, status')
      .eq('order_number', orderNumber)
      .maybeSingle()

    if (error) {
      console.error(error.message)
      setToast({ message: 'Ошибка загрузки: ' + error.message, type: 'error' })
    }

    if (!order) {
      setErrorMsg('Заказ не найден')
      return
    }

    const orderRow = order as OrderRow

    if (orderRow.dropped_at) {
      setAlreadyDropped(true)
      setResultOrder(orderRow)
      return
    }

    const { data: b, error: boxErr } = await supabase
      .from('delivery_boxes')
      .select('id, code, label')
      .eq('seller_id', orderRow.seller_id)
      .order('label')

    if (boxErr) {
      console.error(boxErr.message)
      setToast({ message: 'Ошибка загрузки ящиков: ' + boxErr.message, type: 'error' })
    }

    setResultOrder(orderRow)
    setBoxes((b || []) as BoxRow[])
    if (orderRow.box_id) setSelectedBoxId(orderRow.box_id)
  }

  async function confirmDrop() {
    if (!resultOrder || !selectedBoxId || confirming) return
    setConfirming(true)
    const { error } = await supabase
      .from('orders')
      .update({
        dropped_at: new Date().toISOString(),
        box_id: selectedBoxId,
      })
      .eq('id', resultOrder.id)

    setConfirming(false)

    if (error) {
      setToast({ message: 'Ошибка: ' + error.message, type: 'error' })
      return
    }

    setSuccessMsg('Приёмка у продавца подтверждена')
    setResultOrder(null)
    setBoxes([])
    setSelectedBoxId('')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-4 md:px-8 py-5">
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Сканер</h1>
        <p className="text-sm text-gray-400 mt-0.5">Приём товара у продавца — скан №1</p>
      </header>

      <main className="px-4 md:px-8 py-6 max-w-2xl mx-auto space-y-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-4">
          {!scanning ? (
            <button
              onClick={startScanner}
              className="inline-flex items-center px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-all"
            >
              <Camera className="mr-1.5 h-4 w-4" />
              Начать сканирование
            </button>
          ) : (
            <button
              onClick={stopScanner}
              className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold hover:bg-gray-50 transition-all"
            >
              Остановить
            </button>
          )}
          <div id={READER_ID} className={scanning ? 'max-w-sm' : 'hidden'} />

          <div className="flex items-end gap-2">
            <label className="text-sm flex-1">
              <span className="block text-xs text-gray-500 mb-1">Номер заказа вручную</span>
              <input
                value={manualNumber}
                onChange={(e) => setManualNumber(e.target.value)}
                placeholder="Введите номер"
                className="border border-gray-200 rounded-xl px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
              />
            </label>
            <button
              onClick={() => handleDecoded(extractOrderNumber(manualNumber))}
              className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold hover:bg-gray-50 transition-all"
            >
              Найти
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4" />
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            <CheckCircle2 className="h-4 w-4" />
            {successMsg}
          </div>
        )}

        {boxNoCourier && (
          <div className="flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-700">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              Ящик «{boxNoCourier.box.label}» ({boxNoCourier.box.code}): к зоне
              {boxNoCourier.zoneName ? ` «${boxNoCourier.zoneName}»` : ''} не привязан курьер.{' '}
              <Link href="/admin/zones" className="underline underline-offset-2 font-semibold">
                Привяжите курьера в разделе «Зоны»
              </Link>
              , затем отсканируйте ящик ещё раз.
            </span>
          </div>
        )}

        {boxResult && (
          <div className="rounded-2xl border-4 border-purple-200 bg-purple-50 p-6 space-y-4 text-center">
            <p className="text-sm font-semibold text-gray-500 flex items-center justify-center gap-1.5">
              <Package className="h-4 w-4" />
              Ящик «{boxResult.box.label}» ({boxResult.box.code}) — зона {boxResult.zoneName}
            </p>
            <p className="text-2xl font-black text-purple-700">Курьер: {boxResult.courierName}</p>
            {boxResult.pendingIds.length > 0 ? (
              <>
                <p className="text-sm text-gray-500">
                  Будет назначено на {boxResult.pendingIds.length} заказ(ов)
                  {boxResult.alreadyCount > 0 && ` (ещё ${boxResult.alreadyCount} уже с курьером/завершены)`}
                </p>
                <button
                  onClick={confirmBoxAssign}
                  disabled={assigningBox}
                  className="px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold disabled:opacity-50 transition-all"
                >
                  {assigningBox ? 'Назначаю…' : 'Назначить курьера на весь ящик'}
                </button>
              </>
            ) : (
              <p className="text-sm text-gray-500">
                В ящике нет заказов, ожидающих назначения ({boxResult.alreadyCount} уже с курьером/завершены)
              </p>
            )}
          </div>
        )}

        {resultOrder && !alreadyDropped && (
          <div className="rounded-2xl border-4 border-blue-200 bg-blue-50 p-6 space-y-4">
            <p className="text-sm font-semibold text-gray-500 flex items-center justify-center gap-1.5">
              <Package className="h-4 w-4" />
              Заказ {resultOrder.order_number}
            </p>

            <label className="block text-sm">
              <span className="block text-xs text-gray-500 mb-1">Ящик продавца</span>
              <select
                value={selectedBoxId}
                onChange={(e) => setSelectedBoxId(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2 w-full text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-400"
              >
                <option value="">Выберите ящик</option>
                {boxes.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label} ({b.code})
                  </option>
                ))}
              </select>
              {boxes.length === 0 && (
                <span className="block text-xs text-red-500 mt-1">У продавца нет ящиков</span>
              )}
            </label>

            <div className="text-center pt-1">
              <button
                onClick={confirmDrop}
                disabled={!selectedBoxId || confirming}
                className="px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold disabled:opacity-50 transition-all"
              >
                {confirming ? 'Подтверждаю…' : 'Подтвердить приёмку'}
              </button>
            </div>
          </div>
        )}

        {resultOrder && alreadyDropped && (
          <div className="rounded-2xl border-4 border-gray-200 bg-gray-100 p-8 text-center">
            <p className="text-lg font-bold text-gray-500">Уже принято у продавца</p>
          </div>
        )}
      </main>

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
