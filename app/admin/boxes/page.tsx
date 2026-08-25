'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import QRCode from 'qrcode'
import { supabase } from '@/lib/supabase'
import { loadZones, type Zone } from '@/lib/zones'
import { friendlyDbError } from '@/lib/db-errors'
import { Toast } from '@/components/Toast'

interface Box {
  id: string
  code: string
  label: string
  zone_id: string | null
  zones: { name: string } | null
}

interface SellerOption {
  id: string
  organization_name: string | null
}

function genCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let rand = ''
  for (let i = 0; i < 6; i++) rand += chars[Math.floor(Math.random() * chars.length)]
  return `BOX-${rand}`
}

export default function AdminBoxesPage() {
  const [sellers, setSellers] = useState<SellerOption[]>([])
  const [sellerId, setSellerId] = useState('')
  const [boxes, setBoxes] = useState<Box[]>([])
  const [zones, setZones] = useState<Zone[]>([])
  const [loading, setLoading] = useState(false)

  const [showAddForm, setShowAddForm] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newZoneId, setNewZoneId] = useState('')
  const [savingBox, setSavingBox] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [qrBox, setQrBox] = useState<Box | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null)

  useEffect(() => {
    ;(async () => {
      const { data, error } = await supabase.from('sellers').select('id, organization_name').order('organization_name')
      if (error) console.error(error)
      setSellers((data || []) as SellerOption[])
    })()
  }, [])

  useEffect(() => {
    if (!sellerId) {
      setBoxes([])
      setZones([])
      return
    }
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sellerId])

  useEffect(() => {
    if (!qrBox) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setQrBox(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [qrBox])

  async function loadAll() {
    setLoading(true)
    const [{ data: b, error: bErr }, z] = await Promise.all([
      supabase
        .from('delivery_boxes')
        .select('id, code, label, zone_id, zones ( name )')
        .eq('seller_id', sellerId)
        .order('label'),
      loadZones(sellerId),
    ])
    if (bErr) {
      console.error(bErr)
      setToast({ message: friendlyDbError(bErr, 'Не удалось загрузить ящики'), type: 'error' })
    }
    setBoxes((b || []) as unknown as Box[])
    setZones(z)
    setLoading(false)
  }

  async function addBox() {
    if (!newLabel.trim() || !newZoneId || savingBox || !sellerId) return
    setSavingBox(true)
    const { error } = await supabase.from('delivery_boxes').insert({
      seller_id: sellerId,
      zone_id: newZoneId,
      code: genCode(),
      label: newLabel.trim(),
    })
    if (error) {
      console.error('Ошибка сохранения ящика:', error)
      setToast({ message: friendlyDbError(error, 'Не удалось сохранить ящик'), type: 'error' })
      setSavingBox(false)
      return
    }
    setNewLabel('')
    setNewZoneId('')
    setShowAddForm(false)
    setSavingBox(false)
    setToast({ message: 'Ящик успешно добавлен', type: 'success' })
    loadAll()
  }

  async function deleteBox(box: Box) {
    if (deletingId) return
    if (!confirm(`Удалить ящик "${box.label}"?`)) return
    setDeletingId(box.id)
    const { error } = await supabase.from('delivery_boxes').delete().eq('id', box.id).eq('seller_id', sellerId)
    if (error) {
      console.error('Ошибка удаления ящика:', error)
      setToast({ message: friendlyDbError(error, 'Не удалось удалить ящик'), type: 'error' })
    } else {
      setToast({ message: 'Ящик успешно удалён', type: 'success' })
    }
    setDeletingId(null)
    loadAll()
  }

  async function openQr(box: Box) {
    setQrBox(box)
    setQrDataUrl(null)
    try {
      const dataUrl = await QRCode.toDataURL(box.code, { width: 320, margin: 1 })
      setQrDataUrl(dataUrl)
    } catch (e) {
      console.error(e)
      setToast({ message: 'Не удалось сгенерировать QR-код', type: 'error' })
    }
  }

  function downloadQr() {
    if (!qrDataUrl || !qrBox) return
    const a = document.createElement('a')
    a.href = qrDataUrl
    a.download = `${qrBox.code}.png`
    a.click()
  }

  const qrModalTitle = qrBox ? `${qrBox.label} — ${qrBox.code}` : ''

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-4 md:px-8 py-5">
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Ящики</h1>
        <p className="text-sm text-gray-400 mt-0.5">Ящики доставки продавцов — QR-коды для сдачи/приёма курьером</p>
      </header>

      <main className="px-4 md:px-8 py-6 max-w-7xl mx-auto space-y-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
          <select
            value={sellerId}
            onChange={(e) => setSellerId(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-400 min-w-[240px]"
          >
            <option value="">Выберите продавца</option>
            {sellers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.organization_name || s.id}
              </option>
            ))}
          </select>
          {sellerId && (
            <button
              onClick={() => setShowAddForm((v) => !v)}
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-all"
            >
              Добавить ящик
            </button>
          )}
        </div>

        {!sellerId ? (
          <div className="text-center py-20 text-gray-400 text-sm">Выберите продавца, чтобы увидеть его ящики</div>
        ) : (
          <>
            {showAddForm && (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  addBox()
                }}
                className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex flex-wrap items-end gap-3"
              >
                <label className="text-sm">
                  <span className="block text-xs text-gray-500 mb-1">Название ящика</span>
                  <input
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    className="border border-gray-200 rounded-xl px-3 py-2 w-56 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                    placeholder="Например: Ящик у входа"
                  />
                </label>
                <label className="text-sm">
                  <span className="block text-xs text-gray-500 mb-1">Зона</span>
                  <select
                    value={newZoneId}
                    onChange={(e) => setNewZoneId(e.target.value)}
                    className="border border-gray-200 rounded-xl px-3 py-2 w-56 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-400"
                  >
                    <option value="">Выберите зону</option>
                    {zones.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="submit"
                  disabled={savingBox}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold disabled:opacity-50 transition-all"
                >
                  {savingBox ? 'Сохраняю…' : 'Сохранить'}
                </button>
              </form>
            )}

            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Код</th>
                      <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Название</th>
                      <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Зона</th>
                      <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {loading && (
                      <tr>
                        <td colSpan={4} className="p-6 text-center text-gray-400 text-sm">
                          Загрузка...
                        </td>
                      </tr>
                    )}
                    {!loading && boxes.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-6 text-center text-gray-400 text-sm">
                          Ящиков нет
                        </td>
                      </tr>
                    )}
                    {boxes.map((b) => (
                      <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-4 font-mono font-bold text-gray-900">{b.code}</td>
                        <td className="px-5 py-4 font-semibold text-gray-700">{b.label}</td>
                        <td className="px-5 py-4 text-gray-600">{b.zones?.name || '—'}</td>
                        <td className="px-5 py-4 flex gap-2">
                          <button
                            onClick={() => openQr(b)}
                            className="px-3 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-all"
                          >
                            Показать QR
                          </button>
                          <button
                            onClick={() => deleteBox(b)}
                            disabled={deletingId === b.id}
                            className="px-3 py-1 rounded-lg border border-gray-200 text-xs text-red-600 disabled:opacity-50"
                          >
                            {deletingId === b.id ? 'Удаляю…' : 'Удалить'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>

      {qrBox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setQrBox(null)}
        >
          <div
            className="relative bg-white rounded-2xl p-6 w-[360px] max-w-[90vw] max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setQrBox(null)}
              aria-label="Закрыть"
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-700"
            >
              <X size={20} />
            </button>
            <h3 className="font-bold mb-3">{qrModalTitle}</h3>
            {qrDataUrl ? (
              <img src={qrDataUrl} alt={qrBox.code} className="w-64 h-64 mb-3" />
            ) : (
              <div className="w-64 h-64 mb-3 flex items-center justify-center text-gray-400">Загрузка...</div>
            )}
            <div className="flex gap-2 w-full">
              <button
                onClick={downloadQr}
                disabled={!qrDataUrl}
                className="flex-1 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold disabled:opacity-40 transition-all"
              >
                Скачать QR
              </button>
              <button
                onClick={() => setQrBox(null)}
                className="flex-1 px-4 py-2 rounded-xl border border-gray-200 font-semibold hover:bg-gray-50 transition-all"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
