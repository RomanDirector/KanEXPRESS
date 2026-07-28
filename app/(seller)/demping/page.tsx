'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useLang } from '@/lib/i18n';

interface Rule {
  id: string;
  product_name: string;
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
  const { t } = useLang();
  const [tab, setTab] = useState<'rules' | 'history'>('rules');
  const [rules, setRules] = useState<Rule[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCronInfo, setShowCronInfo] = useState(false);

  const [newName, setNewName] = useState('');
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

  async function loadAll() {
    setLoading(true);
    const [{ data: r, error: rErr }, { data: h, error: hErr }] = await Promise.all([
      supabase
        .from('demping_rules')
        .select(
          'id, product_name, current_price, min_price, max_price, step, position, image_url, is_active, competitor_price, follow_competitor, follow_step'
        )
        .order('product_name'),
      supabase
        .from('demping_history')
        .select('id, product_name, old_price, new_price, triggered_by, created_at')
        .order('created_at', { ascending: false })
        .limit(200),
    ]);
    if (rErr) console.error(rErr);
    if (hErr) console.error(hErr);
    setRules((r || []) as Rule[]);
    setHistory((h || []) as HistoryRow[]);
    setLoading(false);
  }

  async function addRule() {
    if (!newName.trim() || !newPrice || !newMin || !newMax || !newStep) return;
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from('demping_rules').insert({
      seller_id: userData?.user?.id,
      product_name: newName.trim(),
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
      setNewPrice('');
      setNewMin('');
      setNewMax('');
      setNewStep('');
      setNewPosition('');
      setNewCompetitorPrice('');
      setNewFollowCompetitor(false);
      setNewFollowStep('1');
      loadAll();
    }
  }

  async function toggleActive(rule: Rule) {
    const { error } = await supabase
      .from('demping_rules')
      .update({ is_active: !rule.is_active })
      .eq('id', rule.id);
    if (error) console.error(error);
    loadAll();
  }

  async function decreaseOnce(rule: Rule) {
    if (rule.current_price <= rule.min_price || !rule.is_active) return;
    const newPriceVal = Math.max(rule.current_price - rule.step, rule.min_price);

    const { error: e1 } = await supabase
      .from('demping_rules')
      .update({ current_price: newPriceVal })
      .eq('id', rule.id);

    if (e1) {
      console.error(e1);
      alert(t('errorPrefix') + e1.message);
      return;
    }

    const { error: e2 } = await supabase.from('demping_history').insert({
      rule_id: rule.id,
      product_name: rule.product_name,
      old_price: rule.current_price,
      new_price: newPriceVal,
      triggered_by: 'manual',
    });
    if (e2) console.error(e2);

    loadAll();
  }

  // Если наша цена не ниже конкурента — подтягиваем её вниз на follow_step, но не ниже min_price.
  async function recalcByCompetitor(rule: Rule) {
    if (!rule.follow_competitor || rule.competitor_price == null) return;
    if (rule.current_price < rule.competitor_price) return;

    const newPriceVal = Math.max(rule.competitor_price - rule.follow_step, rule.min_price);
    if (newPriceVal === rule.current_price) return;

    const { error: e1 } = await supabase
      .from('demping_rules')
      .update({ current_price: newPriceVal })
      .eq('id', rule.id);
    if (e1) {
      console.error(e1);
      alert(t('errorPrefix') + e1.message);
      return;
    }

    const { error: e2 } = await supabase.from('demping_history').insert({
      rule_id: rule.id,
      product_name: rule.product_name,
      old_price: rule.current_price,
      new_price: newPriceVal,
      triggered_by: 'competitor_follow',
    });
    if (e2) console.error(e2);
  }

  async function recalcByCompetitorBtn(rule: Rule) {
    await recalcByCompetitor(rule);
    loadAll();
  }

  async function updateCompetitorPrice(rule: Rule, value: string) {
    const num = value.trim() === '' ? null : Number(value);
    const { error } = await supabase
      .from('demping_rules')
      .update({ competitor_price: num })
      .eq('id', rule.id);
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
      .eq('id', rule.id);
    if (error) console.error(error);
    loadAll();
  }

  async function updateFollowStep(rule: Rule, value: string) {
    const num = Number(value) || 1;
    const { error } = await supabase
      .from('demping_rules')
      .update({ follow_step: num })
      .eq('id', rule.id);
    if (error) console.error(error);
    loadAll();
  }

  async function deleteRule(rule: Rule) {
    if (!confirm(t('deleteRuleConfirm').replace('{name}', rule.product_name))) return;
    const { error } = await supabase.from('demping_rules').delete().eq('id', rule.id);
    if (error) console.error(error);
    loadAll();
  }

  return (
    <div className="p-4">
      <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
        ⚠️ <b>{t('dempingBannerBold')}</b> {t('dempingBannerRest')}
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
          <div className="bg-white rounded-xl border p-4 mb-4 flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="block text-xs text-gray-500">{t('productHeader')}</span>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="border rounded px-2 py-1.5 w-48"
                placeholder={t('productNamePlaceholder')}
              />
            </label>
            <label className="text-sm">
              <span className="block text-xs text-gray-500">{t('currentPriceLabel')}</span>
              <input
                type="number"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                className="border rounded px-2 py-1.5 w-32"
              />
            </label>
            <label className="text-sm">
              <span className="block text-xs text-gray-500">{t('minPriceLabel')}</span>
              <input
                type="number"
                value={newMin}
                onChange={(e) => setNewMin(e.target.value)}
                className="border rounded px-2 py-1.5 w-32"
              />
            </label>
            <label className="text-sm">
              <span className="block text-xs text-gray-500">{t('maxPriceLabel')}</span>
              <input
                type="number"
                value={newMax}
                onChange={(e) => setNewMax(e.target.value)}
                className="border rounded px-2 py-1.5 w-32"
              />
            </label>
            <label className="text-sm">
              <span className="block text-xs text-gray-500">{t('stepLabel')}</span>
              <input
                type="number"
                value={newStep}
                onChange={(e) => setNewStep(e.target.value)}
                className="border rounded px-2 py-1.5 w-24"
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
              onClick={addRule}
              className="px-4 py-2 rounded bg-blue-600 text-white text-sm font-semibold"
            >
              {t('addRuleBtn')}
            </button>
          </div>

          <div className="bg-white rounded-xl border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b bg-gray-50">
                  <th className="p-3">{t('photoHeader')}</th>
                  <th className="p-3">{t('productHeader')}</th>
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
                    <td colSpan={12} className="p-6 text-center text-gray-500">
                      {t('loading')}
                    </td>
                  </tr>
                )}
                {!loading && rules.length === 0 && (
                  <tr>
                    <td colSpan={12} className="p-6 text-center text-gray-500">
                      {t('noRules')}
                    </td>
                  </tr>
                )}
                {rules.map((r) => {
                  const atMin = r.current_price <= r.min_price;
                  const stepDisabled = atMin || !r.is_active;
                  return (
                    <tr key={r.id} className="border-b hover:bg-gray-50">
                      <td className="p-3">
                        {r.image_url ? (
                          <img
                            src={r.image_url}
                            alt={r.product_name}
                            className="w-10 h-10 rounded object-cover border"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded bg-gray-100 border flex items-center justify-center text-gray-400 text-xs">
                            —
                          </div>
                        )}
                      </td>
                      <td className="p-3 font-semibold">{r.product_name}</td>
                      <td className="p-3">{r.current_price.toLocaleString('ru-RU')} ₸</td>
                      <td className="p-3">{r.min_price.toLocaleString('ru-RU')} ₸</td>
                      <td className="p-3">{r.max_price.toLocaleString('ru-RU')} ₸</td>
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
                          onClick={() => toggleActive(r)}
                          className={`px-3 py-1 rounded-full text-xs font-bold ${
                            r.is_active
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
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
                          onClick={() => decreaseOnce(r)}
                          disabled={stepDisabled}
                          className="px-3 py-1 rounded bg-blue-600 text-white text-xs font-semibold disabled:opacity-40"
                        >
                          {t('decreaseStepBtn')}
                        </button>
                        <button
                          onClick={() => recalcByCompetitorBtn(r)}
                          disabled={!r.follow_competitor || r.competitor_price == null}
                          className="px-3 py-1 rounded bg-purple-600 text-white text-xs font-semibold disabled:opacity-40"
                        >
                          {t('recalcByCompetitorBtn')}
                        </button>
                        <button
                          onClick={() => deleteRule(r)}
                          className="px-3 py-1 rounded border text-xs text-red-600"
                        >
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
                  <td className="p-3">{h.old_price.toLocaleString('ru-RU')} ₸</td>
                  <td className="p-3 text-red-600 font-semibold">
                    {h.new_price.toLocaleString('ru-RU')} ₸
                  </td>
                  <td className="p-3">
                    {h.triggered_by === 'auto'
                      ? t('autoLabel')
                      : h.triggered_by === 'competitor_follow'
                      ? t('competitorFollowLabel')
                      : t('manualLabel')}
                  </td>
                  <td className="p-3 text-gray-500">
                    {new Date(h.created_at).toLocaleString('ru-RU')}
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
  select id, product_name, current_price,
         greatest(current_price - step, min_price), 'auto'
  from demping_rules
  where is_active = true and current_price > min_price;

  update demping_rules
  set current_price = greatest(current_price - step, min_price)
  where is_active = true and current_price > min_price;
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
    </div>
  );
}
