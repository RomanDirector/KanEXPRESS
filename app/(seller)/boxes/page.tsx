'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import QRCode from 'qrcode';
import { supabase } from '@/lib/supabase';
import { useLang } from '@/lib/i18n';
import { loadZones, type Zone } from '@/lib/zones';
import { Toast } from '@/components/Toast';

interface Box {
  id: string;
  code: string;
  label: string;
  zone_id: string | null;
  zones: { name: string } | null;
}

function genCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let rand = '';
  for (let i = 0; i < 6; i++) rand += chars[Math.floor(Math.random() * chars.length)];
  return `BOX-${rand}`;
}

export default function BoxesPage() {
  const { t } = useLang();
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newZoneId, setNewZoneId] = useState('');

  const [qrBox, setQrBox] = useState<Box | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const [sellerId, setSellerId] = useState<string | null>(null);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setSellerId(user?.id ?? null);
    if (!user) {
      setBoxes([]);
      setZones([]);
      setLoading(false);
      return;
    }
    const [{ data: b, error: bErr }, z] = await Promise.all([
      supabase
        .from('delivery_boxes')
        .select('id, code, label, zone_id, zones ( name )')
        .eq('seller_id', user.id)
        .order('label'),
      loadZones(),
    ]);
    if (bErr) {
      console.error(bErr);
      setToast({ message: t('loadErrorPrefix') + bErr.message, type: 'error' });
    }
    setBoxes((b || []) as unknown as Box[]);
    setZones(z);
    setLoading(false);
  }

  async function addBox() {
    if (!newLabel.trim() || !newZoneId) return;
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from('delivery_boxes').insert({
      seller_id: userData?.user?.id,
      zone_id: newZoneId,
      code: genCode(),
      label: newLabel.trim(),
    });
    if (error) {
      alert(t('errorPrefix') + error.message);
      return;
    }
    setNewLabel('');
    setNewZoneId('');
    setShowAddForm(false);
    setToast({ message: t('boxAddedMsg'), type: 'success' });
    loadAll();
  }

  async function deleteBox(box: Box) {
    if (!confirm(t('deleteBoxConfirm').replace('{name}', box.label))) return;
    const { error } = await supabase
      .from('delivery_boxes')
      .delete()
      .eq('id', box.id)
      .eq('seller_id', sellerId ?? '');
    if (error) {
      alert(t('errorPrefix') + error.message);
    } else {
      setToast({ message: t('boxDeletedMsg'), type: 'success' });
    }
    loadAll();
  }

  async function openQr(box: Box) {
    setQrBox(box);
    setQrDataUrl(null);
    try {
      const dataUrl = await QRCode.toDataURL(box.code, { width: 320, margin: 1 });
      setQrDataUrl(dataUrl);
    } catch (e) {
      console.error(e);
      setToast({ message: t('qrGenerateErrorMsg'), type: 'error' });
    }
  }

  function downloadQr() {
    if (!qrDataUrl || !qrBox) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `${qrBox.code}.png`;
    a.click();
  }

  const qrModalTitle = qrBox ? `${qrBox.label} — ${qrBox.code}` : '';

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-800"
          >
            <ArrowLeft size={16} />
            {t('back')}
          </Link>
          <h1 className="text-xl font-bold">{t('boxesTitle')}</h1>
        </div>
        <button
          onClick={() => setShowAddForm((v) => !v)}
          className="px-4 py-2 rounded bg-blue-600 text-white text-sm font-semibold"
        >
          {t('addBoxBtn')}
        </button>
      </div>

      {showAddForm && (
        <div className="bg-white rounded-xl border p-4 mb-4 flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="block text-xs text-gray-500">{t('boxLabelLabel')}</span>
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="border rounded px-2 py-1.5 w-48"
              placeholder={t('boxLabelPlaceholder')}
            />
          </label>
          <label className="text-sm">
            <span className="block text-xs text-gray-500">{t('boxZoneLabel')}</span>
            <select
              value={newZoneId}
              onChange={(e) => setNewZoneId(e.target.value)}
              className="border rounded px-2 py-1.5 w-48"
            >
              <option value="">{t('boxZonePlaceholder')}</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={addBox}
            className="px-4 py-2 rounded bg-blue-600 text-white text-sm font-semibold"
          >
            {t('save')}
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b bg-gray-50">
              <th className="p-3">{t('boxCodeHeader')}</th>
              <th className="p-3">{t('boxLabelHeader')}</th>
              <th className="p-3">{t('boxZoneHeader')}</th>
              <th className="p-3">{t('actionsHeader')}</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={4} className="p-6 text-center text-gray-500">
                  {t('loading')}
                </td>
              </tr>
            )}
            {!loading && boxes.length === 0 && (
              <tr>
                <td colSpan={4} className="p-6 text-center text-gray-500">
                  {t('noBoxes')}
                </td>
              </tr>
            )}
            {boxes.map((b) => (
              <tr key={b.id} className="border-b hover:bg-gray-50">
                <td className="p-3 font-mono font-bold">{b.code}</td>
                <td className="p-3 font-semibold">{b.label}</td>
                <td className="p-3">{b.zones?.name || '—'}</td>
                <td className="p-3 flex gap-2">
                  <button
                    onClick={() => openQr(b)}
                    className="px-3 py-1 rounded bg-blue-600 text-white text-xs font-semibold"
                  >
                    {t('showQrBtn')}
                  </button>
                  <button
                    onClick={() => deleteBox(b)}
                    className="px-3 py-1 rounded border text-xs text-red-600"
                  >
                    {t('delete')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {qrBox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setQrBox(null)}
        >
          <div
            className="bg-white rounded-xl p-6 w-[360px] shadow-2xl flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold mb-3">{qrModalTitle}</h3>
            {qrDataUrl ? (
              <img src={qrDataUrl} alt={qrBox.code} className="w-64 h-64 mb-3" />
            ) : (
              <div className="w-64 h-64 mb-3 flex items-center justify-center text-gray-400">
                {t('loading')}
              </div>
            )}
            <div className="flex gap-2 w-full">
              <button
                onClick={downloadQr}
                disabled={!qrDataUrl}
                className="flex-1 px-4 py-2 rounded bg-blue-600 text-white font-semibold disabled:opacity-40"
              >
                {t('downloadQrBtn')}
              </button>
              <button
                onClick={() => setQrBox(null)}
                className="flex-1 px-4 py-2 rounded border font-semibold"
              >
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
