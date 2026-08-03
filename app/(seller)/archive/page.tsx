'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useLang } from '@/lib/i18n';
import * as XLSX from 'xlsx';
import { Toast } from '@/components/Toast';

interface ArchOrder {
  id: string;
  order_number: string;
  comment: string | null;
  client_phone: string;
  client_address: string;
  status: string;
  photo_url: string | null;
  created_at: string;
}

type Tab = 'delivered' | 'old';

function isShipped(order: ArchOrder) {
  return order.status === 'in_transit' || order.status === 'delivered';
}

export default function ArchivePage() {
  const { t } = useLang();
  const [tab, setTab] = useState<Tab>('delivered');
  const [orders, setOrders] = useState<ArchOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'shipped' | 'not_shipped'>('all');
  const [photoOrder, setPhotoOrder] = useState<ArchOrder | null>(null);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const [sellerId, setSellerId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, [tab]);

  useEffect(() => {
    if (!photoOrder) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPhotoOrder(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [photoOrder]);

  async function load() {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const currentSellerId = user?.id ?? null;
    setSellerId(currentSellerId);
    if (!currentSellerId) {
      setLoading(false);
      return;
    }
    const status = tab === 'delivered' ? 'delivered' : 'archived';
    const { data, error } = await supabase
      .from('orders')
      .select(
        'id, order_number, comment, client_phone, client_address, status, photo_url, created_at'
      )
      .eq('seller_id', currentSellerId)
      .eq('status', status)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('archive load failed:', error);
      setToast({ message: t('loadErrorPrefix') + error.message, type: 'error' });
    }
    setOrders((data || []) as ArchOrder[]);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    let list = orders;

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (o) =>
          o.order_number.toLowerCase().includes(q) ||
          o.client_phone.toLowerCase().includes(q) ||
          o.client_address.toLowerCase().includes(q)
      );
    }

    if (dateFrom) {
      const from = new Date(dateFrom).getTime();
      list = list.filter((o) => new Date(o.created_at).getTime() >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo).getTime() + 24 * 3600 * 1000 - 1;
      list = list.filter((o) => new Date(o.created_at).getTime() <= to);
    }

    if (statusFilter === 'shipped') list = list.filter((o) => isShipped(o));
    if (statusFilter === 'not_shipped') list = list.filter((o) => !isShipped(o));

    return list;
  }, [orders, search, dateFrom, dateTo, statusFilter]);

  const shippedCount = filtered.filter((o) => isShipped(o)).length;
  const deliveredCount = filtered.filter((o) => o.status === 'delivered').length;

  function exportExcel() {
    const rows = filtered.map((o) => ({
      [t('numberCol')]: o.order_number,
      [t('shipmentHeader')]: isShipped(o) ? t('shippedLabel') : t('notShippedLabel'),
      [t('comment')]: o.comment || t('notSpecified'),
      [t('clientPhoneHeader')]: o.client_phone,
      [t('clientAddressHeader')]: o.client_address,
      [t('orderStatusHeader')]: o.status === 'delivered' ? t('issuedLabel') : t('archive'),
      [t('dateCol')]: o.created_at,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t('archive'));
    XLSX.writeFile(wb, 'arhiv_zakazov.xlsx');
  }

  async function uploadPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !photoOrder) return;
    setUploading(true);
    const safeName = file.name
      .replace(/[^\x00-\x7F]/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .toLowerCase() || 'photo.jpg';
    const path = `${photoOrder.id}/${Date.now()}_${safeName}`;
    const { error } = await supabase.storage
      .from('order-photos')
      .upload(path, file);
    if (error) {
      alert(t('uploadErrorPrefix') + error.message);
      setUploading(false);
      return;
    }
    const { data: pub } = supabase.storage
      .from('order-photos')
      .getPublicUrl(path);
    const { error: updateError } = await supabase
      .from('orders')
      .update({ photo_url: pub.publicUrl })
      .eq('id', photoOrder.id)
      .eq('seller_id', sellerId ?? '');
    if (updateError) {
      console.error(updateError);
      setToast({ message: t('saveErrorGeneric'), type: 'error' });
    } else {
      setToast({ message: t('photoUploadedMsg'), type: 'success' });
    }
    setUploading(false);
    setPhotoOrder(null);
    load();
  }

  return (
    <div className="p-4">
      <div className="flex items-center gap-3 mb-4">
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-800"
        >
          <ArrowLeft size={16} />
          {t('back')}
        </Link>
        <h1 className="text-xl font-bold">{t('archive')}</h1>
      </div>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab('delivered')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold ${
            tab === 'delivered' ? 'bg-blue-600 text-white' : 'bg-white border'
          }`}
        >
          {t('deliveredTab')}
        </button>
        <button
          onClick={() => setTab('old')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold ${
            tab === 'old' ? 'bg-blue-600 text-white' : 'bg-white border'
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
          className="border-b px-2 py-1 focus:outline-none focus:border-blue-500 w-56"
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
        <span className="text-blue-700 font-semibold">{t('shippedCountLabel')} {shippedCount}</span>
        <span className="text-blue-700 font-semibold">{t('deliveredCountLabel')} {deliveredCount}</span>
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
                <td className="p-3 text-blue-600 font-semibold">{o.order_number}</td>
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
            className="relative bg-white rounded-xl p-6 w-96 shadow-2xl"
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
            <label className="block px-4 py-2 rounded bg-blue-600 text-white text-center font-semibold cursor-pointer">
              {uploading
                ? t('uploadingLabel')
                : photoOrder.photo_url
                ? t('replacePhoto')
                : t('uploadPhotoBtn')}
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

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}