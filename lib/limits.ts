import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { getSellerPlan } from '@/lib/subscription';

// Единственная платная функция сейчас — демпинг (см. Часть Д ТЗ), поэтому лимит
// проверяется только по demping_rules. Раньше сюда же был заведён 'zones', но зоны
// теперь доступны всем без ограничений — see ZoneMapEditor.tsx, лимит там убран.
export async function checkLimit(
  sellerId: string,
  type: 'demping_rules'
): Promise<{ allowed: boolean; current: number; max: number; error: string | null }> {
  const plan = await getSellerPlan(sellerId);

  // plan_limits: одна строка на план (plan, max_demping_rules, max_zones), 999999 = безлимит.
  const { data: limitData, error: limitError } = await supabase
    .from('plan_limits')
    .select('max_demping_rules')
    .eq('plan', plan)
    .single();

  if (limitError) {
    console.error(`checkLimit: failed to load plan_limits for plan="${plan}"`, limitError);
    // Fail open: a misconfigured/missing plan_limits row must not silently
    // block sellers from using the product (max would otherwise default to 0).
    return { allowed: true, current: 0, max: 0, error: limitError.message };
  }

  const max = (limitData as { max_demping_rules: number } | null)?.max_demping_rules ?? 0;

  const { count, error: countError } = await supabase
    .from('demping_rules')
    .select('*', { count: 'exact', head: true })
    .eq('seller_id', sellerId);

  if (countError) {
    console.error(`checkLimit: failed to count demping_rules`, countError);
    return { allowed: true, current: 0, max, error: countError.message };
  }

  const current = count ?? 0;

  return { allowed: current < max, current, max, error: null };
}

// 999999 в plan_limits — соглашение "безлимит", не показываем это число пользователю.
export function formatLimit(max: number): string {
  return max >= 999999 ? 'Безлимит' : String(max);
}

export interface SubscriptionState {
  status: 'trial' | 'active' | 'expired';
  daysLeft: number;
  trialEndsAt: string | null;
  plan: 'free' | 'pro';
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Date.now()/Date.parse() всегда работают в UTC-миллисекундах с эпохи — сравнение
// корректно независимо от локального часового пояса браузера, пока trial_ends_at/
// expires_at хранятся как ISO-таймстемпы (timestamptz в Postgres). Не использовать
// new Date().getHours()/getDate() и т.п. здесь — они читают локальное время окружения.
//
// Вынесено отдельно от getSubscriptionState, чтобы страницы, уже загрузившие
// plan/expires_at/trial_ends_at своим запросом (например profile/page.tsx), могли
// посчитать статус без второго похода в БД — и чтобы даты считались одинаково везде.
export function computeSubscriptionStatus(input: {
  expiresAt: string | null;
  trialEndsAt: string | null;
}): { status: 'trial' | 'active' | 'expired'; daysLeft: number } {
  const nowMs = Date.now();

  const trialEndsAtMs = input.trialEndsAt ? Date.parse(input.trialEndsAt) : NaN;
  if (!Number.isNaN(trialEndsAtMs) && trialEndsAtMs > nowMs) {
    return { status: 'trial', daysLeft: Math.ceil((trialEndsAtMs - nowMs) / DAY_MS) };
  }

  const expiresAtMs = input.expiresAt ? Date.parse(input.expiresAt) : NaN;
  if (!Number.isNaN(expiresAtMs) && expiresAtMs > nowMs) {
    return { status: 'active', daysLeft: Math.ceil((expiresAtMs - nowMs) / DAY_MS) };
  }

  return { status: 'expired', daysLeft: 0 };
}

// client опционален — по умолчанию анонимный браузерный клиент (для клиентских компонентов),
// серверные роуты (например app/api/kaspi/price) должны передавать сюда admin-клиент,
// т.к. у анонимного клиента в контексте роута нет сессии пользователя для RLS.
export async function getSubscriptionState(
  sellerId: string,
  client: SupabaseClient = supabase
): Promise<SubscriptionState> {
  const { data, error } = await client
    .from('seller_subscriptions')
    .select('plan, expires_at, trial_ends_at')
    .eq('seller_id', sellerId)
    .maybeSingle();

  if (error) {
    console.error('getSubscriptionState: failed to load seller_subscriptions', error);
  }

  const plan: 'free' | 'pro' = data?.plan === 'pro' ? 'pro' : 'free';
  const trialEndsAt: string | null = data?.trial_ends_at ?? null;
  const { status, daysLeft } = computeSubscriptionStatus({
    expiresAt: data?.expires_at ?? null,
    trialEndsAt,
  });

  return { status, daysLeft, trialEndsAt, plan };
}
