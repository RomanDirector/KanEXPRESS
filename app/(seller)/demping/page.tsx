'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Rule {
  id: string;
  product_name: string;
  current_price: number;
  min_price: number;
  step: number;
  is_active: boolean;
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
  const [tab, setTab] = useState<'rules' | 'history'>('rules');
  const [rules, setRules] = useState<Rule[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCronInfo, setShowCronInfo] = useState(false);

  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newMin, setNewMin] = useState('');
  const [newStep, setNewStep] = useState('');

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    const [{ data: r }, { data: h }] = await Promise.all([
      supabase
        .from('demping_rules')
        .select('id, product_name, current_price, min_price, step, is_active')
        .order('product_name'),
      supabase
        .from('demping_history')
        .select('id, product_name, old_price, new_price, triggered_by, created_at')
        .order('created_at', { ascending: false })
        .limit(200),
    ]);
    setRules((r || []) as Rule[]);
    setHistory((h || []) as HistoryRow[]);
    setLoading(false);
  }

  async function addRule() {
    if (!newName.trim() || !newPrice || !newMin || !newStep) return;
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from('demping_rules').insert({
      seller_id: userData?.user?.id,
      product_name: newName.trim(),
      current_price: Number(newPrice),
      min_price: Number(newMin),
      step: Number(newStep),
      is_active: true,
    });
    if (error) alert('Ошибка: ' + error.message);
    else {
      setNewName('');
      setNewPrice('');
      setNewMin('');
      setNewStep('');
      loadAll();
    }
  }

  async function toggleActive(rule: Rule) {
    await supabase
      .from('demping_rules')
      .update({ is_active: !rule.is_active })
      .eq('id', rule.id);
    loadAll();
  }

  async function decreaseOnce(rule: Rule) {
    if (rule.current_price <= rule.min_price) return;
    const newPriceVal = Math.max(rule.current_price - rule.step, rule.min_price);

    const { error: e1 } = await supabase
      .from('demping_rules')
      .update({ current_price: newPriceVal })
      .eq('id', rule.id);

    if (e1) {
      alert('Ошибка: ' + e1.message);
      return;
    }

    await supabase.from('demping_history').insert({
      rule_id: rule.id,
      product_name: rule.product_name,
      old_price: rule.current_price,
      new_price: newPriceVal,
      triggered_by: 'manual',
    });

    loadAll();
  }

  async function deleteRule(rule: Rule) {
    if (!confirm(`Удалить правило для "${rule.product_name}"?`)) return;
    await supabase.from('demping_rules').delete().eq('id', rule.id);
    loadAll();
  }

  return (
    <div className="p-4">
      <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
        ⚠️ <b>Демпинг работает пока только в базе данных.</b> Реальное изменение
        цен на Kaspi.kz подключим, как только будет Kaspi API токен.
      </div>

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Демпинг</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCronInfo(true)}
            className="px-4 py-2 rounded-lg border text-sm font-semibold"
          >
            Автозапуск по расписанию
          </button>
          <div className="flex rounded-lg border overflow-hidden">
            <button
              onClick={() => setTab('rules')}
              className={`px-4 py-2 text-sm font-semibold ${
                tab === 'rules' ? 'bg-blue-600 text-white' : 'bg-white'
              }`}
            >
              Правила
            </button>
            <button
              onClick={() => setTab('history')}
              className={`px-4 py-2 text-sm font-semibold ${
                tab === 'history' ? 'bg-blue-600 text-white' : 'bg-white'
              }`}
            >
              История
            </button>
          </div>
        </div>
      </div>

      {tab === 'rules' && (
        <>
          <div className="bg-white rounded-xl border p-4 mb-4 flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="block text-xs text-gray-500">Товар</span>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="border rounded px-2 py-1.5 w-48"
                placeholder="Название товара"
              />
            </label>
            <label className="text-sm">
              <span className="block text-xs text-gray-500">Текущая цена, ₸</span>
              <input
                type="number"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                className="border rounded px-2 py-1.5 w-32"
              />
            </label>
            <label className="text-sm">
              <span className="block text-xs text-gray-500">Мин. цена, ₸</span>
              <input
                type="number"
                value={newMin}
                onChange={(e) => setNewMin(e.target.value)}
                className="border rounded px-2 py-1.5 w-32"
              />
            </label>
            <label className="text-sm">
              <span className="block text-xs text-gray-500">Шаг, ₸</span>
              <input
                type="number"
                value={newStep}
                onChange={(e) => setNewStep(e.target.value)}
                className="border rounded px-2 py-1.5 w-24"
              />
            </label>
            <button
              onClick={addRule}
              className="px-4 py-2 rounded bg-blue-600 text-white text-sm font-semibold"
            >
              Добавить правило
            </button>
          </div>

          <div className="bg-white rounded-xl border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b bg-gray-50">
                  <th className="p-3">Товар</th>
                  <th className="p-3">Текущая цена</th>
                  <th className="p-3">Мин. цена</th>
                  <th className="p-3">Шаг</th>
                  <th className="p-3">Активно</th>
                  <th className="p-3">Действия</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-gray-500">
                      Загрузка…
                    </td>
                  </tr>
                )}
                {!loading && rules.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-gray-500">
                      Правил нет
                    </td>
                  </tr>
                )}
                {rules.map((r) => (
                  <tr key={r.id} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-semibold">{r.product_name}</td>
                    <td className="p-3">
                      {r.current_price.toLocaleString('ru-RU')} ₸
                      {r.current_price <= r.min_price && (
                        <span className="ml-2 text-xs text-red-500">минимум</span>
                      )}
                    </td>
                    <td className="p-3">{r.min_price.toLocaleString('ru-RU')} ₸</td>
                    <td className="p-3">{r.step.toLocaleString('ru-RU')} ₸</td>
                    <td className="p-3">
                      <button
                        onClick={() => toggleActive(r)}
                        className={`px-3 py-1 rounded-full text-xs font-bold ${
                          r.is_active
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {r.is_active ? 'Вкл' : 'Выкл'}
                      </button>
                    </td>
                    <td className="p-3 flex gap-2">
                      <button
                        onClick={() => decreaseOnce(r)}
                        disabled={r.current_price <= r.min_price}
                        className="px-3 py-1 rounded bg-blue-600 text-white text-xs font-semibold disabled:opacity-40"
                      >
                        Снизить на шаг
                      </button>
                      <button
                        onClick={() => deleteRule(r)}
                        className="px-3 py-1 rounded border text-xs text-red-600"
                      >
                        Удалить
                      </button>
                    </td>
                  </tr>
                ))}
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
                <th className="p-3">Товар</th>
                <th className="p-3">Было</th>
                <th className="p-3">Стало</th>
                <th className="p-3">Кем</th>
                <th className="p-3">Когда</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-gray-500">
                    История пуста
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
                    {h.triggered_by === 'auto' ? 'Авто' : 'Вручную'}
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
            <h3 className="font-bold mb-3">Автозапуск по расписанию</h3>
            <p className="text-sm text-gray-600 mb-3">
              Включается на стороне Supabase (pg_cron). Один раз выполни в SQL
              Editor (сначала включи расширение pg_cron: Database → Extensions):
            </p>
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
              Отключить: <code>select cron.unschedule('daily-demping');</code>
            </p>
            <button
              onClick={() => setShowCronInfo(false)}
              className="px-4 py-2 rounded bg-blue-600 text-white font-semibold"
            >
              Понятно
            </button>
          </div>
        </div>
      )}
    </div>
  );
}