'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Camera, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { Html5Qrcode } from 'html5-qrcode';
import { supabase } from '@/lib/supabase';
import { useLang, localeTag } from '@/lib/i18n';
import { Toast } from '@/components/Toast';
import { waTemplates, openWhatsApp } from '@/lib/whatsapp-templates';

type Mode = 'drop' | 'pickup';

interface OrderRow {
  id: string;
  order_number: string;
  client_phone: string | null;
  zone_id: string | null;
  box_id: string | null;
  dropped_at: string | null;
  accepted_at: string | null;
  status: string;
  zones: { name: string; color: string } | null;
}

interface BoxRow {
  id: string;
  code: string;
  label: string;
}

const READER_ID = 'qr-reader-region';

export default function ScanPage() {
  const { t, lang } = useLang();
  const locale = localeTag(lang);
  const [mode, setMode] = useState<Mode>('drop');
  const [scanning, setScanning] = useState(false);
  const [manualNumber, setManualNumber] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [resultOrder, setResultOrder] = useState<OrderRow | null>(null);
  const [resultBox, setResultBox] = useState<BoxRow | null>(null);
  const [alreadyAccepted, setAlreadyAccepted] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const [sellerId, setSellerId] = useState<string | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setSellerId(user?.id ?? null));
  }, []);

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  function resetResult() {
    setErrorMsg(null);
    setSuccessMsg(null);
    setResultOrder(null);
    setResultBox(null);
    setAlreadyAccepted(false);
  }

  function switchMode(m: Mode) {
    stopScanner();
    setMode(m);
    setManualNumber('');
    resetResult();
  }

  async function stopScanner() {
    const scanner = scannerRef.current;
    if (scanner) {
      try {
        await scanner.stop();
        scanner.clear();
      } catch {
        // сканер мог быть уже остановлен
      }
      scannerRef.current = null;
    }
    setScanning(false);
  }

  async function startScanner() {
    resetResult();
    setScanning(true);
    const { Html5Qrcode } = await import('html5-qrcode');
    const scanner = new Html5Qrcode(READER_ID);
    scannerRef.current = scanner;
    try {
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: 250 },
        (decodedText: string) => {
          stopScanner();
          lookupOrder(decodedText.trim());
        },
        () => {
          // ошибка распознавания одного кадра — игнорируем
        }
      );
    } catch (e) {
      console.error(e);
      setErrorMsg(t('cameraStartError'));
      setScanning(false);
    }
  }

  async function lookupOrder(orderNumber: string) {
    resetResult();
    if (!orderNumber || !sellerId) return;

    const { data: order, error } = await supabase
      .from('orders')
      .select('id, order_number, client_phone, zone_id, box_id, dropped_at, accepted_at, status, zones ( name, color )')
      .eq('seller_id', sellerId)
      .eq('order_number', orderNumber)
      .maybeSingle();

    if (error) {
      console.error(error);
      setToast({ message: t('loadErrorPrefix') + error.message, type: 'error' });
    }

    if (!order) {
      setErrorMsg(t('orderNotFoundError'));
      return;
    }

    const orderRow = order as unknown as OrderRow;

    if (mode === 'drop') {
      if (!orderRow.zone_id) {
        setErrorMsg(t('zoneNotAssignedError'));
        return;
      }
      const { data: box, error: boxErr } = await supabase
        .from('delivery_boxes')
        .select('id, code, label')
        .eq('seller_id', sellerId)
        .eq('zone_id', orderRow.zone_id)
        .limit(1)
        .maybeSingle();
      if (boxErr) {
        console.error(boxErr);
        setToast({ message: t('loadErrorPrefix') + boxErr.message, type: 'error' });
      }
      if (!box) {
        setErrorMsg(t('boxNotFoundForZoneError'));
        return;
      }
      setResultOrder(orderRow);
      setResultBox(box as BoxRow);
    } else {
      if (!orderRow.dropped_at) {
        setErrorMsg(t('notDroppedYetError'));
        return;
      }
      if (orderRow.accepted_at) {
        setAlreadyAccepted(true);
        setResultOrder(orderRow);
        return;
      }
      let box: BoxRow | null = null;
      if (orderRow.box_id) {
        const { data: b, error: boxErr } = await supabase
          .from('delivery_boxes')
          .select('id, code, label')
          .eq('seller_id', sellerId)
          .eq('id', orderRow.box_id)
          .maybeSingle();
        if (boxErr) {
          console.error(boxErr);
          setToast({ message: t('loadErrorPrefix') + boxErr.message, type: 'error' });
        }
        box = b as BoxRow | null;
      }
      setResultOrder(orderRow);
      setResultBox(box);
    }
  }

  async function confirmDrop() {
    if (!resultOrder || !resultBox || !sellerId) return;
    const { error } = await supabase
      .from('orders')
      .update({ dropped_at: new Date().toISOString(), box_id: resultBox.id })
      .eq('id', resultOrder.id)
      .eq('seller_id', sellerId);
    if (error) {
      alert(t('errorPrefix') + error.message);
      return;
    }
    setSuccessMsg(t('dropConfirmedMsg'));
    setResultOrder(null);
    setResultBox(null);
  }

  async function confirmPickup() {
    if (!resultOrder || !sellerId) return;
    const statusChanged = resultOrder.status !== 'in_transit';
    const { error } = await supabase
      .from('orders')
      .update({ accepted_at: new Date().toISOString(), status: 'in_transit' })
      .eq('id', resultOrder.id)
      .eq('seller_id', sellerId);
    if (error) {
      alert(t('errorPrefix') + error.message);
      return;
    }
    setSuccessMsg(t('pickupConfirmedMsg'));
    if (statusChanged && resultOrder.client_phone) {
      const text = waTemplates.order_in_transit({ number: resultOrder.order_number });
      openWhatsApp(resultOrder.client_phone, text);
      setToast({ message: t('waSentMsg'), type: 'success' });
    }
    setResultOrder(null);
    setResultBox(null);
  }

  const zoneColor = resultOrder?.zones?.color || null;

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
          <h1 className="text-xl font-bold">{t('scanTitle')}</h1>
        </div>
        <div className="flex rounded-lg border overflow-hidden">
          <button
            onClick={() => switchMode('drop')}
            className={`px-4 py-2 text-sm font-semibold ${
              mode === 'drop' ? 'bg-blue-600 text-white' : 'bg-white'
            }`}
          >
            {t('scanModeDrop')}
          </button>
          <button
            onClick={() => switchMode('pickup')}
            className={`px-4 py-2 text-sm font-semibold ${
              mode === 'pickup' ? 'bg-blue-600 text-white' : 'bg-white'
            }`}
          >
            {t('scanModePickup')}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-4 mb-4">
        {!scanning ? (
          <button
            onClick={startScanner}
            className="flex items-center gap-2 px-4 py-2 rounded bg-blue-600 text-white text-sm font-semibold"
          >
            <Camera size={16} />
            {t('startScanBtn')}
          </button>
        ) : (
          <button
            onClick={stopScanner}
            className="px-4 py-2 rounded border text-sm font-semibold mb-3"
          >
            {t('stopScanBtn')}
          </button>
        )}
        <div id={READER_ID} className={scanning ? 'mt-3 max-w-sm' : 'hidden'} />

        {mode === 'pickup' && (
          <div className="flex items-end gap-2 mt-4">
            <label className="text-sm">
              <span className="block text-xs text-gray-500">{t('manualOrderNumberLabel')}</span>
              <input
                value={manualNumber}
                onChange={(e) => setManualNumber(e.target.value)}
                className="border rounded px-2 py-1.5 w-48"
                placeholder={t('manualOrderNumberPlaceholder')}
              />
            </label>
            <button
              onClick={() => lookupOrder(manualNumber.trim())}
              className="px-4 py-2 rounded border text-sm font-semibold"
            >
              {t('findOrderBtn')}
            </button>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 mb-4">
          <AlertTriangle size={18} />
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-green-300 bg-green-50 p-4 text-sm text-green-700 mb-4">
          <CheckCircle2 size={18} />
          {successMsg}
        </div>
      )}

      {mode === 'drop' && resultOrder && resultBox && (
        <div
          className="rounded-2xl p-8 text-center border-4"
          style={{
            backgroundColor: zoneColor ? `${zoneColor}22` : '#eff6ff',
            borderColor: zoneColor || '#3b82f6',
          }}
        >
          <p className="text-sm font-semibold text-gray-500 mb-2">
            {t('orderNum')} {resultOrder.order_number}
          </p>
          <p className="text-4xl font-black mb-6" style={{ color: zoneColor || '#1d4ed8' }}>
            {t('dropIntoBoxLabel')}: {resultBox.label}
          </p>
          <button
            onClick={confirmDrop}
            className="px-6 py-3 rounded-xl bg-green-600 text-white font-bold text-lg hover:bg-green-700"
          >
            {t('confirmDropBtn')}
          </button>
        </div>
      )}

      {mode === 'pickup' && resultOrder && !alreadyAccepted && (
        <div className="rounded-2xl p-8 text-center border-4 border-blue-300 bg-blue-50">
          <p className="text-sm font-semibold text-gray-500 mb-2">
            {t('orderNum')} {resultOrder.order_number}
          </p>
          <p className="text-2xl font-black text-blue-700 mb-2">
            {t('foundInBoxLabel')} {resultBox?.label || '—'}
          </p>
          <p className="text-sm text-gray-500 mb-6">
            {t('droppedAtLabel')}{' '}
            {resultOrder.dropped_at ? new Date(resultOrder.dropped_at).toLocaleString(locale) : '—'}
          </p>
          <button
            onClick={confirmPickup}
            className="px-6 py-3 rounded-xl bg-green-600 text-white font-bold text-lg hover:bg-green-700"
          >
            {t('confirmPickupBtn')}
          </button>
        </div>
      )}

      {mode === 'pickup' && resultOrder && alreadyAccepted && (
        <div className="rounded-2xl p-8 text-center border-4 border-gray-200 bg-gray-50">
          <p className="text-lg font-bold text-gray-600">{t('alreadyAcceptedLabel')}</p>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
