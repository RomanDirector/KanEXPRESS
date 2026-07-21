'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface GeocodeKey {
  id: string
  provider: string
  exhausted_at: string | null
  created_at: string
  key_preview: string
}

// Доступ ограничен ADMIN_EMAILS (проверяется сервером в /api/admin/geocode-keys) —
// временная простая защита для MVP, пока нет системы ролей admin.
export default function GeocodeKeysPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [keys, setKeys] = useState<GeocodeKey[]>([])
  const [newKey, setNewKey] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const authHeader = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    return { Authorization: `Bearer ${session?.access_token ?? ''}` }
  }, [])

  const loadKeys = useCallback(async () => {
    const headers = await authHeader()
    const res = await fetch('/api/admin/geocode-keys', { headers })

    if (res.status === 403) {
      router.push('/login')
      return
    }

    const json = await res.json()
    if (!res.ok) {
      setError(json.error ?? 'Не удалось загрузить ключи')
      return
    }

    setKeys(json.keys ?? [])
    setError(null)
  }, [authHeader, router])

  useEffect(() => {
    let cancelled = false

    async function checkAuthAndLoad() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      await loadKeys()
      if (!cancelled) setChecking(false)
    }

    checkAuthAndLoad()

    return () => {
      cancelled = true
    }
  }, [router, loadKeys])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const key = newKey.trim()
    if (!key) return

    setSubmitting(true)
    setError(null)

    const headers = await authHeader()
    const res = await fetch('/api/admin/geocode-keys', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, provider: '2gis' }),
    })
    const json = await res.json()

    if (!res.ok) {
      setError(json.error ?? 'Не удалось добавить ключ')
    } else {
      setNewKey('')
      await loadKeys()
    }
    setSubmitting(false)
  }

  async function handleDelete(id: string) {
    const headers = await authHeader()
    const res = await fetch(`/api/admin/geocode-keys?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers,
    })
    const json = await res.json()

    if (!res.ok) {
      setError(json.error ?? 'Не удалось удалить ключ')
      return
    }
    await loadKeys()
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Ключи геокодирования (2GIS)</h1>
          <p className="text-sm text-gray-500 mt-1">
            Здесь добавляются Basic Key из личного кабинета{' '}
            <a
              href="https://dev.2gis.com"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              dev.2gis.com
            </a>{' '}
            — не ключи openrouteservice/ORS. При исчерпании лимита одного ключа
            система автоматически переключится на следующий из пула.
          </p>
        </div>

        <form onSubmit={handleAdd} className="flex gap-2">
          <Input
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder="Basic Key из dev.2gis.com"
            className="flex-1"
          />
          <Button type="submit" disabled={submitting || !newKey.trim()}>
            Добавить
          </Button>
        </form>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ключ</TableHead>
                <TableHead>Провайдер</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Добавлен</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-gray-400">
                    Ключей пока нет
                  </TableCell>
                </TableRow>
              )}
              {keys.map((k) => (
                <TableRow key={k.id}>
                  <TableCell className="font-mono">{k.key_preview}</TableCell>
                  <TableCell>{k.provider}</TableCell>
                  <TableCell>
                    {k.exhausted_at ? (
                      <span className="text-amber-600">
                        Исчерпан ({new Date(k.exhausted_at).toLocaleString('ru-RU')})
                      </span>
                    ) : (
                      <span className="text-green-600">Активен</span>
                    )}
                  </TableCell>
                  <TableCell>{new Date(k.created_at).toLocaleDateString('ru-RU')}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(k.id)}
                      aria-label="Удалить ключ"
                    >
                      <Trash2 className="size-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
