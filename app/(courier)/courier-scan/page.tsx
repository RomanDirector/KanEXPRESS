'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Html5Qrcode } from 'html5-qrcode'
import { createClient } from '@/lib/supabase'
import { useCourier } from '@/lib/courier-context'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Toast } from '@/components/Toast'
import { waTemplates, openWhatsApp } from '@/lib/whatsapp-templates'
import { Camera, CheckCircle2, AlertTriangle, Package } from 'lucide-react'

interface OrderRow {
  id: string
  order_number: string
  client_phone: string | null
  box_id: string | null
  dropped_at: string | null
  accepted_at: string | null
  status: string
}

interface BoxRow {
  id: string
  code: string
  label: string
}

const READER_ID = 'courier-qr-reader-region'

export default function CourierScanPage() {
  const supabase = useMemo(() => createClient(), [])
  const courier = useCourier()

  const [scanning, setScanning] = useState(false)
  const [manualNumber, setManualNumber] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [resultOrder, setResultOrder] = useState<OrderRow | null>(null)
  const [resultBox, setResultBox] = useState<BoxRow | null>(null)
  const [alreadyAccepted, setAlreadyAccepted] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null)

  const scannerRef = useRef<Html5Qrcode | null>(null)

  useEffect(() => {
    return () => {
      stopScanner()
    }
  }, [])

  function resetResult() {
    setErrorMsg(null)
    setSuccessMsg(null)
    setResultOrder(null)
    setResultBox(null)
    setAlreadyAccepted(false)
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
          lookupOrder(extractOrderNumber(decodedText))
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

  async function lookupOrder(orderNumber: string) {
    resetResult()
    if (!orderNumber) return

    const { data: order, error } = await supabase
      .from('orders')
      .select('id, order_number, client_phone, box_id, dropped_at, accepted_at, status')
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

    if (!orderRow.dropped_at) {
      setErrorMsg('Заказ ещё не сдан в ящик')
      return
    }
    if (orderRow.accepted_at) {
      setAlreadyAccepted(true)
      setResultOrder(orderRow)
      return
    }

    let box: BoxRow | null = null
    if (orderRow.box_id) {
      const { data: b, error: boxErr } = await supabase
        .from('delivery_boxes')
        .select('id, code, label')
        .eq('id', orderRow.box_id)
        .maybeSingle()
      if (boxErr) {
        console.error(boxErr.message)
        setToast({ message: 'Ошибка загрузки: ' + boxErr.message, type: 'error' })
      }
      box = b as BoxRow | null
    }

    setResultOrder(orderRow)
    setResultBox(box)
  }

  async function confirmPickup() {
    if (!resultOrder) return
    const statusChanged = resultOrder.status !== 'in_transit'
    const { error } = await supabase
      .from('orders')
      .update({
        accepted_at: new Date().toISOString(),
        status: 'in_transit',
        courier_name: courier.full_name,
      })
      .eq('id', resultOrder.id)

    if (error) {
      setToast({ message: 'Ошибка: ' + error.message, type: 'error' })
      return
    }

    setSuccessMsg('Приёмка подтверждена')
    if (statusChanged && resultOrder.client_phone) {
      const text = waTemplates.order_in_transit({ number: resultOrder.order_number })
      openWhatsApp(resultOrder.client_phone, text)
      setToast({ message: 'WhatsApp-уведомление отправлено', type: 'success' })
    }
    setResultOrder(null)
    setResultBox(null)
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border px-6 py-4">
        <h2 className="text-xl font-bold text-foreground">Сканер</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Приём заказов из ящика</p>
      </header>

      <main className="px-6 py-6 max-w-2xl mx-auto space-y-4">
        <Card className="rounded-2xl p-4 space-y-4">
          {!scanning ? (
            <Button onClick={startScanner}>
              <Camera className="mr-1.5 h-4 w-4" />
              Начать сканирование
            </Button>
          ) : (
            <Button variant="outline" onClick={stopScanner}>
              Остановить
            </Button>
          )}
          <div id={READER_ID} className={scanning ? 'max-w-sm' : 'hidden'} />

          <div className="flex items-end gap-2">
            <label className="text-sm flex-1">
              <span className="block text-xs text-muted-foreground mb-1">Номер заказа вручную</span>
              <Input
                value={manualNumber}
                onChange={(e) => setManualNumber(e.target.value)}
                placeholder="Введите номер"
              />
            </label>
            <Button variant="outline" onClick={() => lookupOrder(extractOrderNumber(manualNumber))}>
              Найти
            </Button>
          </div>
        </Card>

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

        {resultOrder && !alreadyAccepted && (
          <Card className="rounded-2xl border-4 border-blue-200 bg-blue-50 p-8 text-center space-y-2">
            <p className="text-sm font-semibold text-muted-foreground flex items-center justify-center gap-1.5">
              <Package className="h-4 w-4" />
              Заказ {resultOrder.order_number}
            </p>
            <p className="text-2xl font-black text-blue-700">
              Ящик: {resultBox?.label || '—'}
            </p>
            <div className="pt-2">
              <Button onClick={confirmPickup} className="bg-green-600 hover:bg-green-700 text-white">
                Подтвердить приёмку
              </Button>
            </div>
          </Card>
        )}

        {resultOrder && alreadyAccepted && (
          <Card className="rounded-2xl border-4 border-border bg-secondary p-8 text-center">
            <p className="text-lg font-bold text-muted-foreground">Уже принято</p>
          </Card>
        )}
      </main>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
