'use client'

import { useEffect, useRef, useState } from 'react'
import { load } from '@2gis/mapgl'
import { createTerraDrawWithUI } from '@2gis/mapgl-terra-draw'
import '@2gis/mapgl-terra-draw/dist/mapgl-terra-draw.css'
import { supabase } from '@/lib/supabase'

const ALMATY_CENTER: [number, number] = [76.889709, 43.238949]
const KEY = process.env.NEXT_PUBLIC_2GIS_KEY || ''

const PALETTE = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

interface ZoneRow {
  id: string
  name: string
  color: string
  coordinates: { type: string; coordinates: number[][][] }
}

export default function ZoneMapEditor2GIS() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any>(null)
  const mapglRef = useRef<any>(null)
  const drawRef = useRef<any>(null)
  const savedPolygonsRef = useRef<Map<string, any>>(new Map())

  const [zonesCount, setZonesCount] = useState(0)
  const [pendingFeatureId, setPendingFeatureId] = useState<string | null>(null)
  const [nameModal, setNameModal] = useState(false)
  const [zoneName, setZoneName] = useState('')
  const [saving, setSaving] = useState(false)
  const [selectedZone, setSelectedZone] = useState<ZoneRow | null>(null)

  useEffect(() => {
    let destroyed = false

    load().then((mapgl) => {
      if (destroyed || !containerRef.current) return
      mapglRef.current = mapgl

      const map = new mapgl.Map(containerRef.current, {
        center: ALMATY_CENTER, zoom: 11, key: KEY, enableTrackResize: true,
      })
      mapRef.current = map

      map.on('styleload', () => {
        // Плагин возвращает объект вида { draw, controls } — нам нужен именно .draw
        const created = createTerraDrawWithUI({
          map, mapgl, controls: ['polygon', 'select', 'clear'],
        }) as any

        const draw = created.draw || created
        drawRef.current = draw

        draw.on('finish', (id: string, context: any) => {
          if (context?.action === 'draw') {
            const snapshot = draw.getSnapshot()
            const feature = snapshot.find((f: any) => f.id === id)
            if (feature && feature.geometry.type === 'Polygon') {
              setPendingFeatureId(id)
              setZoneName('')
              setNameModal(true)
            }
          }
        })

        loadZones()
      })
    })

    return () => {
      destroyed = true
      mapRef.current?.destroy()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadZones() {
    const { data, error } = await supabase.from('zones').select('id, name, color, coordinates').order('created_at')
    if (error) { console.error('Ошибка загрузки зон:', error); return }
    const zones = (data || []) as ZoneRow[]
    setZonesCount(zones.length)
    zones.forEach(renderSavedZone)
  }

  function renderSavedZone(zone: ZoneRow) {
    const mapgl = mapglRef.current
    const map = mapRef.current
    if (!mapgl || !map) return

    try {
      const ring = zone.coordinates.coordinates[0] as [number, number][]
      const polygon = new mapgl.Polygon(map, {
        coordinates: [ring],
        color: (zone.color || '#3b82f6') + '59',
        strokeColor: zone.color || '#3b82f6',
        strokeWidth: 3,
      })
      polygon.on('click', () => setSelectedZone(zone))
      savedPolygonsRef.current.set(zone.id, polygon)
    } catch (e) {
      console.error('Не удалось отрисовать зону', zone.name, e)
    }
  }

  async function saveZone() {
    if (!zoneName.trim() || !pendingFeatureId || !drawRef.current) return
    setSaving(true)

    const snapshot = drawRef.current.getSnapshot()
    const feature = snapshot.find((f: any) => f.id === pendingFeatureId)

    if (!feature) { setSaving(false); setNameModal(false); return }

    const geojson = feature.geometry
    const color = PALETTE[zonesCount % PALETTE.length]

    const { data: userData } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('zones')
      .insert({ seller_id: userData?.user?.id, name: zoneName.trim(), coordinates: geojson, color })
      .select('id, name, color, coordinates')
      .single()

    setSaving(false)

    if (error || !data) { alert('Ошибка сохранения: ' + (error?.message || 'unknown')); return }

    drawRef.current.removeFeatures([pendingFeatureId])
    renderSavedZone(data as ZoneRow)
    setZonesCount((c) => c + 1)
    setNameModal(false)
    setPendingFeatureId(null)
  }

  function cancelSave() {
    if (pendingFeatureId && drawRef.current) drawRef.current.removeFeatures([pendingFeatureId])
    setNameModal(false)
    setPendingFeatureId(null)
  }

  async function deleteZone() {
    if (!selectedZone) return
    if (!confirm(`Удалить район «${selectedZone.name}»?`)) return

    const { error } = await supabase.from('zones').delete().eq('id', selectedZone.id)
    if (error) { alert('Ошибка удаления: ' + error.message); return }
    savedPolygonsRef.current.get(selectedZone.id)?.destroy()
    savedPolygonsRef.current.delete(selectedZone.id)
    setSelectedZone(null)
    setZonesCount((c) => Math.max(0, c - 1))
  }

  function resetView() {
    mapRef.current?.setCenter(ALMATY_CENTER)
    mapRef.current?.setZoom(11)
  }

  return (
    <div className="relative w-full h-[calc(100vh-72px)]">
      <div ref={containerRef} className="w-full h-full" />

      <div className="absolute bottom-4 left-3 z-10 bg-white rounded-xl shadow-lg px-3 py-2 text-xs text-gray-500 max-w-[220px]">
        Выбери «полигон» на панели слева на карте, нарисуй район кликами, заверши двойным кликом. Удалить сохранённый район — клик по нему справа.
      </div>

      {selectedZone && (
        <div className="absolute top-3 right-3 z-10 bg-white rounded-xl shadow-lg p-4 w-60">
          <p className="font-bold mb-1" style={{ color: selectedZone.color }}>{selectedZone.name}</p>
          <div className="flex gap-2">
            <button onClick={deleteZone} className="flex-1 px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-bold">🗑 Удалить</button>
            <button onClick={() => setSelectedZone(null)} className="px-3 py-2 rounded-lg border text-sm text-gray-600">Закрыть</button>
          </div>
        </div>
      )}

      <button onClick={resetView} className="absolute bottom-4 right-4 z-10 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-black shadow-lg">
        АЛМАТЫ
      </button>

      {nameModal && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 w-96 shadow-2xl">
            <h3 className="text-lg font-bold mb-3">Название района</h3>
            <input
              autoFocus value={zoneName} onChange={(e) => setZoneName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveZone()}
              placeholder="Например: Бостандыкский"
              className="w-full border rounded-xl px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-red-400"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={cancelSave} className="px-4 py-2 rounded-xl border text-gray-600">Отмена</button>
              <button onClick={saveZone} disabled={saving || !zoneName.trim()} className="px-4 py-2 rounded-xl bg-red-600 text-white font-semibold disabled:opacity-50">
                {saving ? 'Сохраняю…' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}