'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useLang, localeTag } from '@/lib/i18n';
import { checkLimit, formatLimit, getSubscriptionState, type SubscriptionState } from '@/lib/limits';
import { Toast } from '@/components/Toast';

interface Rule {
  id: string;
  product_name: string;
  sku: string | null;
  current_price: number;
  min_price: number;
  max_price: number;
  step: number;
  position: string | null;
  image_url: string | null;
  is_active: boolean;
  competitor_price: number | null;
  follow_competitor: boolean;
  follow_step: number;
}

interface HistoryRow {
  id: string;
  product_name: string | null;
  old_price: number;
  new_price: number;
  triggered_by: string;
  created_at: string;
}

export default function DempingPage() {
  const { t, lang } = useLang();
  const locale = localeTag(lang);
  const [tab, setTab] = useState<'rules' | 'history'>('rules');
  const [rules, setRules] = useState<Rule[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCronInfo, setShowCronInfo] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const [uploadingPhotoId, setUploadingPhotoId] = useState<string | null>(null);
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [autoScheduleEnabled, setAutoScheduleEnabled] = useState(false);
  const [savingAutoSchedule, setSavingAutoSchedule] = useState(false);
  const [subState, setSubState] = useState<SubscriptionState | null>(null);
  const [addingRule, setAddingRule] = useState(false);
  // Блокировка построчных действий по id правила (не общим флагом), чтобы клик
  // по одной строке не отключал кнопки во всех остальных. Значение — какое именно
  // действие идёт, чтобы спиннер показывался только на нажатой кнопке.
  const [busyRules, setBusyRules] = useState<Record<string, 'decrease' | 'recalc' | 'toggle' | 'delete'>>({});
  const isRowBusy = (id: string) => Boolean(busyRules[id]);
  async function runRowAction(id: string, action: 'decrease' | 'recalc' | 'toggle' | 'delete', fn: () => Promise<void>) {
    if (busyRules[id]) return;
    setBusyRules((prev) => ({ ...prev, [id]: action }));
    try {
      await fn();
    } finally {
      setBusyRules((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  }

  const [newName, setNewName] = useState('');
  const [newSku, setNewSku] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newMin, setNewMin] = useState('');
  const [newMax, setNewMax] = useState('');
  const [newStep, setNewStep] = useState('');
  const [newPosition, setNewPosition] = useState('');
  const [newCompetitorPrice, setNewCompetitorPrice] = useState('');
  const [newFollowCompetitor, setNewFollowCompetitor] = useState(false);
  const [newFollowStep, setNewFollowStep] = useState('1');

  useEffect(() => {
    loadAll();
  }, []);

  // Escape закрывает модалку с инструкцией по cron, как и остальные модалки в проекте.
  useEffect(() => {
    if (!showCronInfo) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowCronInfo(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showCronInfo]);

  async function loadAll() {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setSellerId(user?.id ?? null);

    if (!user) {
      setRules([]);
      setHistory([]);
      setAutoScheduleEnabled(false);
      setSubState(null);
      setLoading(false);
      return;
    }

    const [{ data: r, error: rErr }, settingsResult] = await Promise.all([
      supabase
        .from('demping_rules')
        .select(
          'id, product_name, sku, current_price, min_price, max_price, step, position, image_url, is_active, competitor_price, follow_competitor, follow_step'
        )
        .eq('seller_id', user.id)
        .order('product_name'),
      supabase
        .from('demping_settings')
        .select('auto_enabled')
        .eq('seller_id', user.id)
        .maybeSingle(),
    ]);
    if (rErr) {
      console.error(rErr);
      setToast({ message: t('loadErrorPrefix') + rErr.message, type: 'error' });
    }
    if (settingsResult.error) console.error(settingsResult.error);
    const ruleRows = (r || []) as Rule[];
    setRules(ruleRows);
    setAutoScheduleEnabled(Boolean(settingsResult.data?.auto_enabled));
    setSubState(await getSubscriptionState(user.id));

    // demping_history не хранит seller_id — своя история определяется через
    // принадлежность rule_id правилам текущего продавца.
    const ruleIds = ruleRows.map((rule) => rule.id);
    if (ruleIds.length === 0) {
      setHistory([]);
    } else {
      const { data: h, error: hErr } = await supabase
        .from('demping_history')
        .select('id, product_name, old_price, new_price, triggered_by, created_at')
        .in('rule_id', ruleIds)
        .order('created_at', { ascending: false })
        .limit(200);
      if (hErr) console.error(hErr);
      setHistory((h || []) as HistoryRow[]);
    }
    setLoading(false);
  }

  async function toggleAutoSchedule() {
    if (!sellerId) return;
    const next = !autoScheduleEnabled;
    setSavingAutoSchedule(true);
    setAutoScheduleEnabled(next);
    const { error } = await supabase
      .from('demping_settings')
      .upsert({ seller_id: sellerId, auto_enabled: next }, { onConflict: 'seller_id' });
    setSavingAutoSchedule(false);
    if (error) {
      console.error(error);
      setAutoScheduleEnabled(!next);
      setToast({ message: t('saveChangesErrorPrefix') + error.message, type: 'error' });
      return;
    }
    setToast({
      message: next ? t('autoScheduleOnMsg') : t('autoScheduleOffMsg'),
      type: 'success',
    });
  }

  async function addRule() {
    if (!newName.trim() || !newPrice || !newMin || !newMax || !newStep) {
      setToast({
        message: t('requiredFieldsMsg'),
        type: 'error',
      });
      return;
    }
    if (Number(newPrice) <= 0 || Number(newMin) <= 0 || Number(newMax) <= 0) {
      setToast({ message: t('pricesNotPositiveErrorMsg'), type: 'error' });
      return;
    }
    if (Number(newMin) >= Number(newMax)) {
      setToast({ message: t('minMaxPriceErrorMsg'), type: 'error' });
      return;
    }
    if (Number(newStep) <= 0) {
      setToast({ message: t('stepNotPositiveErrorMsg'), type: 'error' });
      return;
    }
    if (newFollowCompetitor && Number(newFollowStep) <= 0) {
      setToast({ message: t('followStepErrorMsg'), type: 'error' });
      return;
    }
    setAddingRule(true);
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    const sellerId = userData?.user?.id;
    if (userErr || !sellerId) {
      console.error('addRule: failed to resolve current user', userErr);
      setToast({
        message: t('resolveUserErrorPrefix') + (userErr?.message || t('sessionExpiredMsg')),
        type: 'error',
      });
      setAddingRule(false);
      return;
    }

    const { allowed, max, error: limitErr } = await checkLimit(sellerId, 'demping_rules');
    if (limitErr) {
      console.error('addRule: checkLimit failed, failing open', limitErr);
    }
    if (!allowed) {
      alert(t('limitReachedMsg').replace('{max}', formatLimit(max)));
      setAddingRule(false);
      return;
    }

    const { error } = await supabase.from('demping_rules').insert({
      seller_id: sellerId,
      product_name: newName.trim(),
      sku: newSku.trim() || null,
      current_price: Number(newPrice),
      min_price: Number(newMin),
      max_price: Number(newMax),
      step: Number(newStep),
      position: newPosition.trim() || null,
      is_active: true,
      competitor_price: newCompetitorPrice ? Number(newCompetitorPrice) : null,
      follow_competitor: newFollowCompetitor,
      follow_step: newFollowStep ? Number(newFollowStep) : 1,
    });
    if (error) alert(t('errorPrefix') + error.message);
    else {
      setNewName('');
      setNewSku('');
      setNewPrice('');
      setNewMin('');
      setNewMax('');
      setNewStep('');
      setNewPosition('');
      setNewCompetitorPrice('');
      setNewFollowCompetitor(false);
      setNewFollowStep('1');
      setToast({ message: t('ruleAddedMsg'), type: 'success' });
      loadAll();
    }
    setAddingRule(false);
  }

  async function toggleActive(rule: Rule) {
    const { error } = await supabase
      .from('demping_rules')
      .update({ is_active: !rule.is_active })
      .eq('id', rule.id)
      .eq('seller_id', sellerId ?? '');
    if (error) {
      console.error(error);
      setToast({ message: t('saveErrorGeneric'), type: 'error' });
    }
    loadAll();
  }

  function priceChangeToast(oldPrice: number, newPrice: number) {
    setToast({
      message: t('priceDecreasedMsg')
        .replace('{old}', oldPrice.toLocaleString(locale))
        .replace('{new}', newPrice.toLocaleString(locale)),
      type: 'success',
    });
  }

  // Публикация на Kaspi — через серверный роут (токен туда не попадает на клиент).
  // Локальный демпинг не должен ломаться из-за недоступности Kaspi: цена в БД уже изменена к этому моменту.
  async function publishToKaspi(ruleId: string) {
    try {
      const res = await fetch('/api/kaspi/price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruleId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        // Роут /api/kaspi/price — серверный код, отвечает фиксированной русской строкой
        // (не может звать t()). На казахском UI подменяем на переведённый текст.
        const errorText =
          body.error === 'У товара не заполнен артикул (SKU)' ? t('skuMissingErrorMsg') : body.error;
        setToast({
          message: t('kaspiPublishFailedPrefix') + (errorText || t('serverErrorGeneric')),
          type: 'error',
        });
      }
    } catch (err) {
      console.error(err);
      setToast({
        message: t('kaspiNoConnectionMsg'),
        type: 'error',
      });
    }
  }

  async function decreaseOnce(rule: Rule) {
    if (rule.current_price <= rule.min_price || !rule.is_active) return;
    const newPriceVal = Math.min(Math.max(rule.current_price - rule.step, rule.min_price), rule.max_price);

    const { error: e1 } = await supabase
      .from('demping_rules')
      .update({ current_price: newPriceVal })
      .eq('id', rule.id)
      .eq('seller_id', sellerId ?? '');

    if (e1) {
      console.error(e1);
      alert(t('errorPrefix') + e1.message);
      return;
    }

    priceChangeToast(rule.current_price, newPriceVal);

    const { error: e2 } = await supabase.from('demping_history').insert({
      rule_id: rule.id,
      product_name: rule.product_name,
      old_price: rule.current_price,
      new_price: newPriceVal,
      triggered_by: 'manual',
    });
    if (e2) {
      console.error(e2);
      setToast({ message: t('saveErrorGeneric'), type: 'error' });
    }

    publishToKaspi(rule.id);
    loadAll();
  }

  // Если наша цена не ниже конкурента — подтягиваем её вниз на follow_step, но не ниже min_price.
  // is_active === false блокирует автоследование за конкурентом так же, как блокирует decreaseOnce.
  async function recalcByCompetitor(rule: Rule) {
    if (!rule.is_active) return;
    if (!rule.follow_competitor || rule.competitor_price == null) return;
    if (rule.current_price < rule.competitor_price) return;

    const newPriceVal = Math.min(Math.max(rule.competitor_price - rule.follow_step, rule.min_price), rule.max_price);
    if (newPriceVal === rule.current_price) return;

    const { error: e1 } = await supabase
      .from('demping_rules')
      .update({ current_price: newPriceVal })
      .eq('id', rule.id)
      .eq('seller_id', sellerId ?? '');
    if (e1) {
      console.error(e1);
      alert(t('errorPrefix') + e1.message);
      return;
    }

    priceChangeToast(rule.current_price, newPriceVal);

    const { error: e2 } = await supabase.from('demping_history').insert({
      rule_id: rule.id,
      product_name: rule.product_name,
      old_price: rule.current_price,
      new_price: newPriceVal,
      triggered_by: 'competitor_follow',
    });
    if (e2) {
      console.error(e2);
      setToast({ message: t('saveErrorGeneric'), type: 'error' });
    }

    publishToKaspi(rule.id);
  }

  async function recalcByCompetitorBtn(rule: Rule) {
    await recalcByCompetitor(rule);
    loadAll();
  }

  async function updateSku(rule: Rule, value: string) {
    const sku = value.trim() || null;
    if (sku === (rule.sku ?? null)) return;
    const { error } = await supabase
      .from('demping_rules')
      .update({ sku })
      .eq('id', rule.id)
      .eq('seller_id', sellerId ?? '');
    if (error) {
      console.error(error);
      alert(t('errorPrefix') + error.message);
      return;
    }
    loadAll();
  }

  async function updateCompetitorPrice(rule: Rule, value: string) {
    const num = value.trim() === '' ? null : Number(value);
    const { error } = await supabase
      .from('demping_rules')
      .update({ competitor_price: num })
      .eq('id', rule.id)
      .eq('seller_id', sellerId ?? '');
    if (error) {
      console.error(error);
      alert(t('errorPrefix') + error.message);
      return;
    }
    await recalcByCompetitor({ ...rule, competitor_price: num });
    loadAll();
  }

  async function toggleFollowCompetitor(rule: Rule) {
    const { error } = await supabase
      .from('demping_rules')
      .update({ follow_competitor: !rule.follow_competitor })
      .eq('id', rule.id)
      .eq('seller_id', sellerId ?? '');
    if (error) {
      console.error(error);
      setToast({ message: t('saveErrorGeneric'), type: 'error' });
    }
    loadAll();
  }

  async function updateFollowStep(rule: Rule, value: string) {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) {
      setToast({ message: t('followStepErrorMsg'), type: 'error' });
      loadAll();
      return;
    }
    const { error } = await supabase
      .from('demping_rules')
      .update({ follow_step: num })
      .eq('id', rule.id)
      .eq('seller_id', sellerId ?? '');
    if (error) {
      console.error(error);
      setToast({ message: t('saveErrorGeneric'), type: 'error' });
    }
    loadAll();
  }

  async function uploadRulePhoto(rule: Rule, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhotoId(rule.id);

    const safeName = file.name
      .replace(/[^\x00-\x7F]/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .toLowerCase() || 'photo.jpg';
    const path = `demping/${rule.id}/${Date.now()}_${safeName}`;
    const { error } = await supabase.storage.from('order-photos').upload(path, file);

    if (error) {
      console.error(error);
      setToast({ message: t('uploadErrorPrefix') + error.message, type: 'error' });
      setUploadingPhotoId(null);
      e.target.value = '';
      return;
    }

    const { data: pub } = supabase.storage.from('order-photos').getPublicUrl(path);

    // Оптимистично показываем превью сразу, не дожидаясь ответа update().
    setRules((prev) =>
      prev.map((r) => (r.id === rule.id ? { ...r, image_url: pub.publicUrl } : r))
    );

    const { error: updateError } = await supabase
      .from('demping_rules')
      .update({ image_url: pub.publicUrl })
      .eq('id', rule.id)
      .eq('seller_id', sellerId ?? '');

    if (updateError) {
      console.error(updateError);
      setToast({ message: t('photoSaveErrorPrefix') + updateError.message, type: 'error' });
      setRules((prev) =>
        prev.map((r) => (r.id === rule.id ? { ...r, image_url: rule.image_url } : r))
      );
    } else {
      setToast({ message: t('photoUploadedMsg'), type: 'success' });
    }

    setUploadingPhotoId(null);
    e.target.value = '';
  }

  async function deleteRule(rule: Rule) {
    if (!confirm(t('deleteRuleConfirm').replace('{name}', rule.product_name))) return;
    const { error } = await supabase
      .from('demping_rules')
      .delete()
      .eq('id', rule.id)
      .eq('seller_id', sellerId ?? '');
    if (error) {
      console.error(error);
      setToast({ message: t('saveErrorGeneric'), type: 'error' });
    } else {
      setToast({ message: t('ruleDeletedMsg'), type: 'success' });
    }
    loadAll();
  }

  const isExpired = subState?.status === 'expired';

  return (
    <div className="p-4">
      <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
        ⚠️ <b>{t('dempingBannerBold')}</b> {t('dempingBannerRest')}
      </div>

      {subState?.status === 'trial' && (
        <div className="mb-4 rounded-xl border border-blue-300 bg-blue-50 p-4 text-sm text-blue-800">
          {t('trialBannerPrefix')} {subState.daysLeft} {t(subState.daysLeft === 1 ? 'dayWordOne' : 'dayWordMany')}
          {t('trialBannerRest')}
        </div>
      )}

      {isExpired && (
        <div className="mb-4 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800 flex flex-wrap items-center justify-between gap-3">
          <span className="font-semibold">
            {t('expiredBannerMsg')}
          </span>
          <Link
            href="/profile"
            className="shrink-0 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700"
          >
            {t('extendSubscriptionBtn')}
          </Link>
        </div>
      )}

      <div className="bg-white rounded-xl border p-4 mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900">{t('autoScheduleTitle')}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {autoScheduleEnabled ? t('on') : t('off')}
          </p>
        </div>
        <button
          onClick={toggleAutoSchedule}
          disabled={savingAutoSchedule || !sellerId || isExpired}
          title={isExpired ? t('subscriptionExpiredTooltip') : undefined}
          className={`relative w-11 h-6 rounded-full transition-colors shrink-0 disabled:opacity-50 ${
            autoScheduleEnabled ? 'bg-blue-600' : 'bg-gray-200'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform shadow ${
              autoScheduleEnabled ? 'translate-x-5' : ''
            }`}
          />
        </button>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-800"
          >
            <ArrowLeft size={16} />
            {t('back')}
          </Link>
          <h1 className="text-xl font-bold">{t('demping')}</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCronInfo(true)}
            className="px-4 py-2 rounded-lg border text-sm font-semibold"
          >
            {t('dempingCronBtn')}
          </button>
          <div className="flex rounded-lg border overflow-hidden">
            <button
              onClick={() => setTab('rules')}
              className={`px-4 py-2 text-sm font-semibold ${
                tab === 'rules' ? 'bg-blue-600 text-white' : 'bg-white'
              }`}
            >
              {t('dempingRulesTab')}
            </button>
            <button
              onClick={() => setTab('history')}
              className={`px-4 py-2 text-sm font-semibold ${
                tab === 'history' ? 'bg-blue-600 text-white' : 'bg-white'
              }`}
            >
              {t('dempingHistoryTab')}
            </button>
          </div>
        </div>
      </div>

      {tab === 'rules' && (
        <>
          <form
            onSubmit={(e) => { e.preventDefault(); addRule(); }}
            className="bg-white rounded-xl border p-4 mb-4 flex flex-wrap items-end gap-3"
          >
            <label className="text-sm">
              <span className="block text-xs text-gray-500">{t('productHeader')} *</span>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="border rounded px-2 py-1.5 w-48"
                placeholder={t('productNamePlaceholder')}
                required
              />
            </label>
            <label className="text-sm">
              <span className="block text-xs text-gray-500">{t('skuLabel')}</span>
              <input
                value={newSku}
                onChange={(e) => setNewSku(e.target.value)}
                className="border rounded px-2 py-1.5 w-32"
                placeholder={t('skuPlaceholder')}
              />
            </label>
            <label className="text-sm">
              <span className="block text-xs text-gray-500">{t('currentPriceLabel')} *</span>
              <input
                type="number"
                min="1"
                step="any"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                className="border rounded px-2 py-1.5 w-32"
                required
              />
            </label>
            <label className="text-sm">
              <span className="block text-xs text-gray-500">{t('minPriceLabel')} *</span>
              <input
                type="number"
                min="1"
                step="any"
                value={newMin}
                onChange={(e) => setNewMin(e.target.value)}
                className="border rounded px-2 py-1.5 w-32"
                required
              />
            </label>
            <label className="text-sm">
              <span className="block text-xs text-gray-500">{t('maxPriceLabel')} *</span>
              <input
                type="number"
                min="1"
                step="any"
                value={newMax}
                onChange={(e) => setNewMax(e.target.value)}
                className="border rounded px-2 py-1.5 w-32"
                required
              />
            </label>
            <label className="text-sm">
              <span className="block text-xs text-gray-500">{t('stepLabel')} *</span>
              <input
                type="number"
                min="1"
                step="any"
                value={newStep}
                onChange={(e) => setNewStep(e.target.value)}
                className="border rounded px-2 py-1.5 w-24"
                required
              />
            </label>
            <label className="text-sm">
              <span className="block text-xs text-gray-500">{t('positionHeader')}</span>
              <input
                value={newPosition}
                onChange={(e) => setNewPosition(e.target.value)}
                className="border rounded px-2 py-1.5 w-28"
                placeholder={t('positionPlaceholder')}
              />
            </label>
            <label className="text-sm">
              <span className="block text-xs text-gray-500">{t('competitorPriceLabel')}</span>
              <input
                type="number"
                value={newCompetitorPrice}
                onChange={(e) => setNewCompetitorPrice(e.target.value)}
                className="border rounded px-2 py-1.5 w-32"
              />
            </label>
            <label className="text-sm flex items-center gap-2 pb-1.5">
              <input
                type="checkbox"
                checked={newFollowCompetitor}
                onChange={(e) => setNewFollowCompetitor(e.target.checked)}
                className="w-4 h-4 accent-blue-600"
              />
              <span className="text-xs text-gray-500">{t('followCompetitorLabel')}</span>
            </label>
            {newFollowCompetitor && (
              <label className="text-sm">
                <span className="block text-xs text-gray-500">{t('followStepLabel')}</span>
                <input
                  type="number"
                  value={newFollowStep}
                  onChange={(e) => setNewFollowStep(e.target.value)}
                  className="border rounded px-2 py-1.5 w-24"
                />
              </label>
            )}
            <button
              type="submit"
              disabled={addingRule}
              className="px-4 py-2 rounded bg-blue-600 text-white text-sm font-semibold disabled:opacity-50"
            >
              {addingRule ? t('loading') : t('addRuleBtn')}
            </button>
          </form>

          <div className="bg-white rounded-xl border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b bg-gray-50">
                  <th className="p-3">{t('photoHeader')}</th>
                  <th className="p-3">{t('productHeader')}</th>
                  <th className="p-3">{t('skuHeader')}</th>
                  <th className="p-3">{t('currentPriceHeader')}</th>
                  <th className="p-3">{t('minPriceHeader')}</th>
                  <th className="p-3">{t('maxPriceHeader')}</th>
                  <th className="p-3">{t('positionHeader')}</th>
                  <th className="p-3">{t('competitorPriceHeader')}</th>
                  <th className="p-3">{t('followCompetitorHeader')}</th>
                  <th className="p-3">{t('followStepHeader')}</th>
                  <th className="p-3">{t('dempingHeader')}</th>
                  <th className="p-3">{t('status')}</th>
                  <th className="p-3">{t('actionsHeader')}</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={13} className="p-6 text-center text-gray-500">
                      {t('loading')}
                    </td>
                  </tr>
                )}
                {!loading && rules.length === 0 && (
                  <tr>
                    <td colSpan={13} className="p-6 text-center text-gray-500">
                      <p>{t('noRules')}</p>
                      <p className="text-xs text-gray-400 mt-1">{t('dempingNoRulesMsg')}</p>
                    </td>
                  </tr>
                )}
                {rules.map((r) => {
                  const atMin = r.current_price <= r.min_price;
                  const stepDisabled = atMin || !r.is_active;
                  return (
                    <tr key={r.id} className="border-b hover:bg-gray-50">
                      <td className="p-3">
                        <label
                          className="relative block w-10 h-10 rounded border cursor-pointer group overflow-hidden"
                          title={r.image_url ? t('replacePhoto') : t('uploadPhotoBtn')}
                        >
                          {r.image_url ? (
                            <img
                              src={r.image_url}
                              alt={r.product_name}
                              className="w-10 h-10 rounded object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center text-gray-400 text-xs">
                              📷
                            </div>
                          )}
                          {uploadingPhotoId === r.id && (
                            <div className="absolute inset-0 bg-white/70 flex items-center justify-center text-[10px] text-gray-600">
                              {t('uploadingLabel')}
                            </div>
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => uploadRulePhoto(r, e)}
                            className="hidden"
                            disabled={uploadingPhotoId === r.id}
                          />
                        </label>
                      </td>
                      <td className="p-3 font-semibold">{r.product_name}</td>
                      <td className="p-3">
                        <input
                          defaultValue={r.sku ?? ''}
                          onBlur={(e) => updateSku(r, e.target.value)}
                          placeholder={t('skuPlaceholder')}
                          className="border rounded px-2 py-1 w-28"
                        />
                      </td>
                      <td className="p-3">{r.current_price.toLocaleString(locale)} ₸</td>
                      <td className="p-3">{r.min_price.toLocaleString(locale)} ₸</td>
                      <td className="p-3">{r.max_price.toLocaleString(locale)} ₸</td>
                      <td className="p-3">{r.position || '—'}</td>
                      <td className="p-3">
                        <input
                          type="number"
                          defaultValue={r.competitor_price ?? ''}
                          onBlur={(e) => updateCompetitorPrice(r, e.target.value)}
                          className="border rounded px-2 py-1 w-28"
                        />
                      </td>
                      <td className="p-3">
                        <button
                          onClick={() => toggleFollowCompetitor(r)}
                          className={`px-3 py-1 rounded-full text-xs font-bold ${
                            r.follow_competitor
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {r.follow_competitor ? t('on') : t('off')}
                        </button>
                      </td>
                      <td className="p-3">
                        {r.follow_competitor ? (
                          <input
                            type="number"
                            defaultValue={r.follow_step ?? 1}
                            onBlur={(e) => updateFollowStep(r, e.target.value)}
                            className="border rounded px-2 py-1 w-20"
                          />
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="p-3">
                        <button
                          onClick={() => runRowAction(r.id, 'toggle', () => toggleActive(r))}
                          disabled={isRowBusy(r.id)}
                          className={`px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1 disabled:opacity-50 ${
                            r.is_active
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {busyRules[r.id] === 'toggle' && <Loader2 size={12} className="animate-spin" />}
                          {r.is_active ? t('on') : t('off')}
                        </button>
                      </td>
                      <td className="p-3">
                        {atMin ? (
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700">
                            {t('stuckAtMin')}
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
                            {t('active')}
                          </span>
                        )}
                      </td>
                      <td className="p-3 flex gap-2">
                        <button
                          onClick={() => runRowAction(r.id, 'decrease', () => decreaseOnce(r))}
                          disabled={stepDisabled || isExpired || isRowBusy(r.id)}
                          title={
                            isExpired
                              ? t('subscriptionExpiredTooltip')
                              : atMin
                              ? t('stuckAtMinTooltip')
                              : !r.is_active
                              ? t('ruleInactiveTooltip')
                              : undefined
                          }
                          className="px-3 py-1 rounded bg-blue-600 text-white text-xs font-semibold disabled:opacity-40 inline-flex items-center gap-1"
                        >
                          {busyRules[r.id] === 'decrease' && <Loader2 size={12} className="animate-spin" />}
                          {t('decreaseStepBtn')}
                        </button>
                        <button
                          onClick={() => runRowAction(r.id, 'recalc', () => recalcByCompetitorBtn(r))}
                          disabled={!r.follow_competitor || r.competitor_price == null || !r.is_active || isExpired || isRowBusy(r.id)}
                          title={isExpired ? t('subscriptionExpiredTooltip') : undefined}
                          className="px-3 py-1 rounded bg-purple-600 text-white text-xs font-semibold disabled:opacity-40 inline-flex items-center gap-1"
                        >
                          {busyRules[r.id] === 'recalc' && <Loader2 size={12} className="animate-spin" />}
                          {t('recalcByCompetitorBtn')}
                        </button>
                        <button
                          onClick={() => runRowAction(r.id, 'delete', () => deleteRule(r))}
                          disabled={isRowBusy(r.id)}
                          className="px-3 py-1 rounded border text-xs text-red-600 disabled:opacity-40 inline-flex items-center gap-1"
                        >
                          {busyRules[r.id] === 'delete' && <Loader2 size={12} className="animate-spin" />}
                          {t('delete')}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'history' && (
        <div className="bg-white rounded-xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b bg-gray-50">
                <th className="p-3">{t('productHeader')}</th>
                <th className="p-3">{t('wasLabel')}</th>
                <th className="p-3">{t('becameLabel')}</th>
                <th className="p-3">{t('byWhomLabel')}</th>
                <th className="p-3">{t('whenLabel')}</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-gray-500">
                    {t('historyEmpty')}
                  </td>
                </tr>
              )}
              {history.map((h) => (
                <tr key={h.id} className="border-b hover:bg-gray-50">
                  <td className="p-3 font-semibold">{h.product_name || '—'}</td>
                  <td className="p-3">{h.old_price.toLocaleString(locale)} ₸</td>
                  <td className="p-3 text-red-600 font-semibold">
                    {h.new_price.toLocaleString(locale)} ₸
                  </td>
                  <td className="p-3">
                    {h.triggered_by === 'auto'
                      ? t('autoLabel')
                      : h.triggered_by === 'competitor_follow'
                      ? t('competitorFollowLabel')
                      : t('manualLabel')}
                  </td>
                  <td className="p-3 text-gray-500">
                    {new Date(h.created_at).toLocaleString(locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCronInfo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setShowCronInfo(false)}
        >
          <div
            className="bg-white rounded-xl p-6 w-[560px] max-w-[90vw] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold mb-3">{t('dempingCronBtn')}</h3>
            <p className="text-sm text-gray-600 mb-3">{t('cronModalIntro')}</p>
            <pre className="bg-gray-900 text-green-300 text-xs rounded-lg p-3 overflow-x-auto mb-3">
{`select cron.schedule(
  'daily-demping', '0 9 * * *',
  $$
  insert into demping_history
    (rule_id, product_name, old_price, new_price, triggered_by)
  select r.id, r.product_name, r.current_price,
         least(greatest(r.current_price - r.step, r.min_price), r.max_price), 'auto'
  from demping_rules r
  join demping_settings s on s.seller_id = r.seller_id
  where r.is_active = true
    and s.auto_enabled = true
    and r.current_price > r.min_price;

  update demping_rules r
  set current_price = least(greatest(r.current_price - r.step, r.min_price), r.max_price)
  from demping_settings s
  where s.seller_id = r.seller_id
    and r.is_active = true
    and s.auto_enabled = true
    and r.current_price > r.min_price;
  $$
);`}
            </pre>
            <p className="text-sm text-gray-600 mb-4">
              {t('cronDisableLabel')} <code>select cron.unschedule('daily-demping');</code>
            </p>
            <button
              onClick={() => setShowCronInfo(false)}
              className="px-4 py-2 rounded bg-blue-600 text-white font-semibold"
            >
              {t('gotIt')}
            </button>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
